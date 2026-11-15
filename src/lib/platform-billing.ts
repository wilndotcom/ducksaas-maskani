import { prisma } from './prisma'
import { notifyTelegram } from './telegram'
import { calculatePlanAmount, normalizePricingModel, type BillingCycle } from './saas-billing'
import type { PaymentGatewayProvider } from '@prisma/client'

function appUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.length === 9) return `254${digits}`
  return digits
}

export type SubscriptionInitiateResult = {
  sessionId: string
  status: 'pending' | 'instructions'
  message: string
  authorizationUrl?: string | null
  amount: number
  currency: string
}

/**
 * Starts a subscription payment for an organization using the PLATFORM's
 * payment credentials (env), not the landlord's rent-collection gateways.
 * Supported: Paystack (card) via PAYSTACK_SECRET_KEY, M-Pesa via MPESA_* envs.
 */
export async function initiateSubscriptionPayment(params: {
  organizationId: string
  planId: string
  billingCycle: BillingCycle
  phone?: string
  email?: string
}): Promise<SubscriptionInitiateResult> {
  const { organizationId, planId, billingCycle } = params

  const [org, plan] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, subscriptionEndsAt: true, _count: { select: { properties: true } } },
    }),
    prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
  ])
  if (!org) throw new Error('Organization not found')
  if (!plan || !plan.isActive) throw new Error('Subscription plan not found or inactive')

  const breakdown = calculatePlanAmount(plan, org._count.properties, billingCycle)
  if (breakdown.amount <= 0) throw new Error('Plan amount is zero — nothing to pay')

  const pending = await prisma.paymentSession.findFirst({
    where: { organizationId, kind: 'subscription', status: 'pending' },
    select: { id: true },
  })
  if (pending) throw new Error('A subscription payment is already pending for this organization')

  const currency = plan.currency || 'KES'

  // --- Paystack (card / mobile money via Paystack) ---
  const paystackKey = process.env.PAYSTACK_SECRET_KEY
  if (paystackKey && params.email) {
    const amount = Math.round(breakdown.amount * 100)
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        amount,
        currency,
        callback_url: `${appUrl()}/maskani/settings/payment-plan?paid=1`,
        metadata: {
          type: 'subscription',
          organizationId,
          planId: plan.id,
          billingCycle,
          amount: breakdown.amount,
        },
      }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.status) throw new Error(data.message || 'Card payment initialization failed')

    const session = await prisma.paymentSession.create({
      data: {
        organizationId,
        kind: 'subscription',
        planId: plan.id,
        billingCycle,
        provider: 'paystack_subaccount',
        reference: String(data.data.reference || ''),
        email: params.email,
        amount: breakdown.amount,
        currency,
        status: 'pending',
        authorizationUrl: String(data.data.authorization_url || ''),
      },
    })
    return {
      sessionId: session.id,
      status: 'pending',
      message: 'Redirecting to secure payment…',
      authorizationUrl: session.authorizationUrl,
      amount: breakdown.amount,
      currency,
    }
  }

  // --- M-Pesa STK push (platform Paybill/Till) ---
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_SHORTCODE } = process.env
  if (MPESA_CONSUMER_KEY && MPESA_CONSUMER_SECRET && MPESA_PASSKEY && MPESA_SHORTCODE && params.phone) {
    const phone = normalizePhone(params.phone)
    const key = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64')
    const tokenRes = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${key}` },
      cache: 'no-store',
    })
    const tokenData = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !tokenData.access_token) throw new Error('M-Pesa authentication failed')

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64')
    const stkRes = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBill',
        Amount: Math.ceil(breakdown.amount),
        PartyA: phone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: `${appUrl()}/api/webhooks/mpesa`,
        AccountReference: `DUCK-${org.slug.slice(0, 8).toUpperCase()}`,
        TransactionDesc: `${plan.name} ${billingCycle}`.slice(0, 13),
      }),
      cache: 'no-store',
    })
    const stkData = await stkRes.json().catch(() => ({}))
    if (!stkRes.ok || stkData.ResponseCode !== '0') {
      throw new Error(stkData.errorMessage || stkData.ResponseDescription || 'M-Pesa STK push failed')
    }

    const session = await prisma.paymentSession.create({
      data: {
        organizationId,
        kind: 'subscription',
        planId: plan.id,
        billingCycle,
        provider: 'mpesa_paybill',
        checkoutRequestId: String(stkData.CheckoutRequestID || ''),
        reference: String(stkData.MerchantRequestID || ''),
        phone,
        amount: breakdown.amount,
        currency,
        status: 'pending',
      },
    })
    return {
      sessionId: session.id,
      status: 'pending',
      message: 'Check your phone and enter your M-Pesa PIN to complete payment.',
      amount: breakdown.amount,
      currency,
    }
  }

  throw new Error('Online subscription payment is not configured. Please contact support to pay manually.')
}

function periodEndFrom(start: Date, cycle: BillingCycle) {
  const end = new Date(start)
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  return end
}

/**
 * Activates/extends an org subscription after a confirmed platform payment.
 * Creates the SaaS ledger entry, sets the plan, extends subscriptionEndsAt,
 * and reactivates the org. Idempotent via transactionRef.
 */
export async function activateSubscriptionFromSession(session: {
  id: string
  organizationId: string
  planId: string | null
  billingCycle: string | null
  amount: number
  provider: PaymentGatewayProvider
}, transactionRef: string) {
  if (!session.planId) return { skipped: true as const, reason: 'no_plan' as const }

  const existing = await prisma.saaSSubscriptionLedger.findFirst({ where: { transactionRef } })
  if (existing) {
    await prisma.paymentSession.updateMany({ where: { id: session.id, status: 'pending' }, data: { status: 'success' } })
    return { duplicate: true as const }
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: session.planId } })
  if (!plan) return { skipped: true as const, reason: 'plan_missing' as const }

  const cycle: BillingCycle = session.billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const now = new Date()
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { subscriptionEndsAt: true },
  })
  // Extend from current period end if still active, else from now
  const base = org?.subscriptionEndsAt && org.subscriptionEndsAt > now ? org.subscriptionEndsAt : now
  const periodEnd = periodEndFrom(base, cycle)

  await prisma.$transaction(async (tx) => {
    await tx.saaSSubscriptionLedger.create({
      data: {
        organizationId: session.organizationId,
        planId: plan.id,
        amount: session.amount,
        gateway: session.provider === 'mpesa_paybill' || session.provider === 'mpesa_till' ? 'mpesa' : 'paystack',
        transactionRef,
        status: 'active',
        periodStart: now,
        periodEnd,
      },
    })
    await tx.organization.update({
      where: { id: session.organizationId },
      data: {
        subscriptionPlanId: plan.id,
        subscriptionEndsAt: periodEnd,
        status: 'active',
      },
    })
    await tx.paymentSession.updateMany({
      where: { id: session.id, status: 'pending' },
      data: { status: 'success' },
    })
  })

  await notifyTelegram('Subscription activated via online payment', {
    event: 'subscription_activated',
    organizationId: session.organizationId,
    planId: plan.id,
    planName: plan.name,
    cycle,
    amount: session.amount,
    periodEnd: periodEnd.toISOString(),
    reference: transactionRef,
  })
  return { duplicate: false as const, periodEnd }
}

export { normalizePricingModel }
