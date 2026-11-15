import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { notifyTelegram } from '@/lib/telegram'
import { applySuccessfulPayment, findPaymentSessionByGateway, markPaymentSession } from '@/lib/payments'
import { activateSubscriptionFromSession } from '@/lib/platform-billing'

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

type DarajaCallback = {
  MerchantRequestID?: string
  CheckoutRequestID?: string
  ResultCode?: number
  ResultDesc?: string
  CallbackMetadata?: { Item?: { Name: string; Value?: unknown }[] }
}

function parseDarajaCallback(body: { Body?: { stkCallback?: DarajaCallback } }): { callback: DarajaCallback | null; items: Record<string, unknown> } {
  const cb = body?.Body?.stkCallback as DarajaCallback | undefined
  if (!cb) return { callback: null, items: {} }
  const items: Record<string, unknown> = {}
  for (const item of cb.CallbackMetadata?.Item || []) {
    if (item?.Name) items[item.Name] = item.Value
  }
  return { callback: cb, items }
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

    // --- Real Daraja STK push callback ---
    const { callback: stk, items } = parseDarajaCallback(body)
    if (stk) {
      const checkoutRequestId = String(stk.CheckoutRequestID || '')
      const resultCode = Number(stk.ResultCode ?? -1)
      if (resultCode !== 0) {
        await markPaymentSession({ checkoutRequestId, status: 'failed', failureReason: stk.ResultDesc || `ResultCode ${resultCode}` })
        await notifyTelegram('M-Pesa STK payment failed/cancelled', { event: 'mpesa_stk_failed', checkoutRequestId, resultCode, resultDesc: stk.ResultDesc })
        return NextResponse.json({ ok: true, result: 'failed' })
      }

      const session = await findPaymentSessionByGateway({ checkoutRequestId })
      if (!session) {
        await notifyTelegram('M-Pesa webhook ignored: unknown checkout request', { event: 'mpesa_unknown_session', checkoutRequestId })
        return NextResponse.json({ ok: true, ignored: true, reason: 'session_not_found' })
      }
      if (session.status !== 'pending') {
        return NextResponse.json({ ok: true, idempotent: true })
      }

      const amount = Number(items.Amount ?? session.amount)
      const reference = String(items.MpesaReceiptNumber || items.TransID || session.reference || checkoutRequestId)

      // Subscription (SaaS plan) payments activate/extend the org subscription
      if (session.kind === 'subscription') {
        const result = await activateSubscriptionFromSession(session, reference)
        return NextResponse.json({ ok: true, subscription: result })
      }
      if (!session.invoiceId) {
        await notifyTelegram('M-Pesa webhook ignored: session has no invoice', { event: 'mpesa_session_no_invoice', sessionId: session.id })
        return NextResponse.json({ ok: true, ignored: true, reason: 'no_invoice' })
      }

      const paidAt = items.TransactionDate ? new Date(String(items.TransactionDate)) : new Date()

      const result = await applySuccessfulPayment({
        organizationId: session.organizationId,
        invoiceId: session.invoiceId,
        amount: Number.isFinite(amount) && amount > 0 ? amount : session.amount,
        paymentMethod: 'mpesa_stk',
        gatewayReference: reference,
        paidAt: isNaN(paidAt.getTime()) ? new Date() : paidAt,
        sessionId: session.id,
      })

      if ('overpaid' in result) {
        await notifyTelegram('M-Pesa webhook rejected: overpayment', { event: 'mpesa_webhook_overpay', invoiceId: session.invoiceId, amount, due: result.amountDue })
        return NextResponse.json({ ok: false, error: 'overpayment' }, { status: 400 })
      }
      if ('notFound' in result) {
        return NextResponse.json({ ok: true, ignored: true, reason: 'invoice_not_found' })
      }
      if ('duplicate' in result) {
        return NextResponse.json({ ok: true, idempotent: true })
      }

      await notifyTelegram('M-Pesa STK payment recorded via webhook', {
        event: 'mpesa_stk_payment_recorded',
        organizationId: session.organizationId,
        invoiceId: session.invoiceId,
        amount,
        reference,
      })
      return NextResponse.json({ ok: true })
    }

    // --- Normalized payload fallback: { organizationId, invoiceId, amount, reference, paidAt } ---
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

    const paidAt = paidAtStr ? new Date(paidAtStr) : new Date()
    const result = await applySuccessfulPayment({
      organizationId,
      invoiceId: invoice.id,
      amount,
      paymentMethod: 'mpesa_c2b',
      gatewayReference: reference || null,
      paidAt: isNaN(paidAt.getTime()) ? new Date() : paidAt,
    })

    if ('overpaid' in result) {
      await notifyTelegram('M-Pesa webhook rejected: overpayment', { event: 'mpesa_webhook_overpay', organizationId, invoiceId, amount, due: result.amountDue, paid: result.amountPaid })
      return NextResponse.json({ ok: false, error: 'overpayment' }, { status: 400 })
    }
    if ('notFound' in result) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'invoice_not_found' })
    }
    if ('duplicate' in result) {
      return NextResponse.json({ ok: true, idempotent: true })
    }

    await notifyTelegram('M-Pesa payment recorded via webhook', { event: 'mpesa_payment_recorded', organizationId, invoiceId, amount, reference })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await notifyTelegram('M-Pesa webhook error', { event: 'mpesa_webhook_error', error: message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
