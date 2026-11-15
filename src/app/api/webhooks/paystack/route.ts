import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { notifyTelegram } from '@/lib/telegram'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET
    if (secret) {
      const sig = req.headers.get('x-paystack-signature') || ''
      const hash = crypto.createHmac('sha512', secret).update(raw).digest('hex')
      if (!sig || hash !== sig) {
        return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
      }
    }

    const body = JSON.parse(raw || '{}')
    const event = String(body.event || '')
    if (event !== 'charge.success') {
      return NextResponse.json({ ok: true, ignored: true, reason: 'event' })
    }

    const data = body.data || {}
    const meta = data.metadata || {}
    const organizationId = String(meta.organizationId || meta.orgId || '')
    const invoiceId = String(meta.invoiceId || '')
    const amount = Number(data.amount || 0) / 100
    const reference = String(data.reference || '').trim()
    const paidAtStr = data.paid_at || data.created_at || null

    if (!organizationId || !invoiceId || !Number.isFinite(amount) || amount <= 0) {
      await notifyTelegram('Paystack webhook ignored: invalid payload', { event: 'paystack_webhook_invalid', organizationId, invoiceId, amount, reference })
      return NextResponse.json({ ok: true, ignored: true, reason: 'invalid_payload' })
    }

    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } })
    if (!invoice) {
      await notifyTelegram('Paystack webhook ignored: invoice not found', { event: 'paystack_webhook_not_found', organizationId, invoiceId, reference })
      return NextResponse.json({ ok: true, ignored: true, reason: 'invoice_not_found' })
    }

    if (reference) {
      const existing = await prisma.rentPayment.findFirst({ where: { organizationId, gatewayReference: reference } })
      if (existing) return NextResponse.json({ ok: true, idempotent: true })
    }

    const paidAt = paidAtStr ? new Date(paidAtStr) : new Date()
    const safePaidAt = isNaN(paidAt.getTime()) ? new Date() : paidAt
    const newPaid = invoice.amountPaid + amount
    if (newPaid > invoice.amountDue + 0.01) {
      await notifyTelegram('Paystack webhook rejected: overpayment', { event: 'paystack_webhook_overpay', organizationId, invoiceId, amount })
      return NextResponse.json({ ok: false, error: 'overpayment' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.rentPayment.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          tenantUserId: invoice.tenantUserId,
          amount,
          paymentMethod: 'card',
          gatewayReference: reference || null,
          paidAt: safePaidAt,
        },
      })
      const status = newPaid >= invoice.amountDue - 0.001 ? 'paid' : newPaid > 0 ? 'partial' : invoice.dueDate < new Date() ? 'overdue' : 'unpaid'
      await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: newPaid, status } })
    })

    // If this payment is for subscription renewal context, reactivate org (metadata.type === 'subscription')
    if (String(meta.type || '') === 'subscription') {
      const ends = new Date()
      const months = Number(meta.months || 1)
      ends.setMonth(ends.getMonth() + (Number.isFinite(months) && months > 0 ? months : 1))
      await prisma.organization.update({
        where: { id: organizationId },
        data: { status: 'active', subscriptionEndsAt: ends },
      })
      await notifyTelegram('Organization subscription reactivated via Paystack', { event: 'subscription_reactivated', organizationId, endsAt: ends.toISOString(), reference })
    }

    await notifyTelegram('Paystack payment recorded via webhook', { event: 'paystack_payment_recorded', organizationId, invoiceId, amount, reference })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    await notifyTelegram('Paystack webhook error', { event: 'paystack_webhook_error', error: e?.message || String(e) })
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}