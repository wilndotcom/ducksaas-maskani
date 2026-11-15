import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { notifyTelegram } from '@/lib/telegram'
import { applySuccessfulPayment, findPaymentSessionByGateway, markPaymentSession } from '@/lib/payments'
import { activateSubscriptionFromSession } from '@/lib/platform-billing'

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
    const data = body.data || {}
    const reference = String(data.reference || '').trim()

    if (event === 'charge.failed') {
      await markPaymentSession({ reference, status: 'failed', failureReason: String(data.gateway_response || 'charge failed') })
      return NextResponse.json({ ok: true, result: 'failed' })
    }
    if (event !== 'charge.success') {
      return NextResponse.json({ ok: true, ignored: true, reason: 'event' })
    }

    const meta = data.metadata || {}
    const amount = Number(data.amount || 0) / 100
    const paidAtStr = data.paid_at || data.created_at || null

    // Prefer the PaymentSession created at initiation time (reference is unique per transaction)
    const session = reference ? await findPaymentSessionByGateway({ reference }) : null

    // Subscription (SaaS plan) payments activate/extend the org subscription
    if (session?.kind === 'subscription') {
      if (session.status !== 'pending') return NextResponse.json({ ok: true, idempotent: true })
      const result = await activateSubscriptionFromSession(session, reference || session.id)
      return NextResponse.json({ ok: true, subscription: result })
    }

    const organizationId = session?.organizationId || String(meta.organizationId || meta.orgId || '')
    const invoiceId = session?.invoiceId || String(meta.invoiceId || '')

    if (!organizationId || !invoiceId || !Number.isFinite(amount) || amount <= 0) {
      await notifyTelegram('Paystack webhook ignored: invalid payload', { event: 'paystack_webhook_invalid', organizationId, invoiceId, amount, reference })
      return NextResponse.json({ ok: true, ignored: true, reason: 'invalid_payload' })
    }

    const paidAt = paidAtStr ? new Date(paidAtStr) : new Date()
    const result = await applySuccessfulPayment({
      organizationId,
      invoiceId,
      amount,
      paymentMethod: 'card',
      gatewayReference: reference || null,
      paidAt: isNaN(paidAt.getTime()) ? new Date() : paidAt,
      sessionId: session?.id || null,
    })

    if ('overpaid' in result) {
      await notifyTelegram('Paystack webhook rejected: overpayment', { event: 'paystack_webhook_overpay', organizationId, invoiceId, amount })
      return NextResponse.json({ ok: false, error: 'overpayment' }, { status: 400 })
    }
    if ('notFound' in result) {
      await notifyTelegram('Paystack webhook ignored: invoice not found', { event: 'paystack_webhook_not_found', organizationId, invoiceId, reference })
      return NextResponse.json({ ok: true, ignored: true, reason: 'invoice_not_found' })
    }
    if ('duplicate' in result) {
      return NextResponse.json({ ok: true, idempotent: true })
    }

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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await notifyTelegram('Paystack webhook error', { event: 'paystack_webhook_error', error: message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
