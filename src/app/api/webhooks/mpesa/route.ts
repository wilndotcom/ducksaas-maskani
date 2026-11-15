import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { notifyTelegram } from '@/lib/telegram'

export const runtime = 'nodejs'

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const secret = process.env.MPESA_WEBHOOK_SECRET
    if (secret) {
      const sig = req.headers.get('x-mpesa-signature') || req.headers.get('x-webhook-signature') || ''
      const raw = JSON.stringify(body)
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
      if (!sig || !safeEqual(sig, expected)) {
        return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
      }
    }

    // Expected normalized payload shape (adapt as needed to Daraja callback mapping):
    // { organizationId, invoiceId, amount, reference, paidAt }
    const organizationId = String(body.organizationId || body.orgId || '')
    const invoiceId = String(body.invoiceId || '')
    const amount = Number(body.amount || body.Amount || 0)
    const reference = String(body.reference || body.TransID || body.MpesaReceiptNumber || body.transactionId || '').trim()
    const paidAtStr = String(body.paidAt || body.TransactionDate || '') || null

    if (!organizationId || !invoiceId || !Number.isFinite(amount) || amount <= 0) {
      await notifyTelegram('M-Pesa webhook ignored: invalid payload', { event: 'mpesa_webhook_invalid', organizationId, invoiceId, amount, reference, hasSecret: !!secret })
      return NextResponse.json({ ok: true, ignored: true, reason: 'invalid_payload' })
    }

    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId } })
    if (!invoice) {
      await notifyTelegram('M-Pesa webhook ignored: invoice not found', { event: 'mpesa_webhook_not_found', organizationId, invoiceId, reference })
      return NextResponse.json({ ok: true, ignored: true, reason: 'invoice_not_found' })
    }

    // Idempotency by gateway reference
    if (reference) {
      const existing = await prisma.rentPayment.findFirst({ where: { organizationId, gatewayReference: reference } })
      if (existing) {
        return NextResponse.json({ ok: true, idempotent: true })
      }
    }

    const paidAt = paidAtStr ? new Date(paidAtStr) : new Date()
    const safePaidAt = isNaN(paidAt.getTime()) ? new Date() : paidAt
    const newPaid = invoice.amountPaid + amount
    if (newPaid > invoice.amountDue + 0.01) {
      await notifyTelegram('M-Pesa webhook rejected: overpayment', { event: 'mpesa_webhook_overpay', organizationId, invoiceId, amount, due: invoice.amountDue, paid: invoice.amountPaid })
      return NextResponse.json({ ok: false, error: 'overpayment' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.rentPayment.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          tenantUserId: invoice.tenantUserId,
          amount,
          paymentMethod: 'mpesa_c2b',
          gatewayReference: reference || null,
          paidAt: safePaidAt,
        },
      })
      const status = newPaid >= invoice.amountDue - 0.001 ? 'paid' : newPaid > 0 ? 'partial' : invoice.dueDate < new Date() ? 'overdue' : 'unpaid'
      await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: newPaid, status } })
    })

    await notifyTelegram('M-Pesa payment recorded via webhook', { event: 'mpesa_payment_recorded', organizationId, invoiceId, amount, reference })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    await notifyTelegram('M-Pesa webhook error', { event: 'mpesa_webhook_error', error: e?.message || String(e) })
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}