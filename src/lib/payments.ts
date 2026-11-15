import { prisma } from './prisma'
import { notifyTelegram } from './telegram'
import type { PaymentGatewayProvider, Prisma } from '@prisma/client'

export type GatewayCredentials = Record<string, string>

function appUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/** Credentials are stored as JSON in apiCredentialsEncrypted (field name is historical). */
export function parseGatewayCredentials(raw: Prisma.JsonValue | null): GatewayCredentials {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: GatewayCredentials = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
    else if (typeof v === 'number') out[k] = String(v)
  }
  return out
}

export async function getOrgGateways(organizationId: string) {
  return prisma.landlordPaymentGateway.findMany({
    where: { organizationId, isActive: true },
  })
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  if (digits.length === 9) return `254${digits}`
  return digits
}

async function darajaToken(creds: GatewayCredentials) {
  const key = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64')
  const res = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${key}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error('M-Pesa authentication failed')
  return data.access_token as string
}

function stkPassword(shortcode: string, passkey: string) {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  return {
    timestamp,
    password: Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64'),
  }
}

async function initiateMpesa(params: {
  organizationId: string
  invoice: { id: string; invoiceNumber: string; amountDue: number; amountPaid: number; tenantUserId: string }
  gateway: { provider: PaymentGatewayProvider; accountNumber: string }
  creds: GatewayCredentials
  phone: string
}) {
  const { invoice, gateway, creds, phone } = params
  const shortcode = creds.shortcode || gateway.accountNumber
  const passkey = creds.passkey
  if (!shortcode || !passkey || !creds.consumerKey || !creds.consumerSecret) {
    throw new Error('M-Pesa gateway is not fully configured (shortcode/passkey/consumer key required)')
  }
  const amount = Math.ceil(invoice.amountDue - invoice.amountPaid)
  if (amount <= 0) throw new Error('Invoice has no outstanding balance')

  const token = await darajaToken(creds)
  const { timestamp, password } = stkPassword(shortcode, passkey)
  const isTill = gateway.provider === 'mpesa_till'
  const res = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: isTill ? 'CustomerBuyGoodsAndDeliver' : 'CustomerPayBill',
      Amount: amount,
      PartyA: normalizePhone(phone),
      PartyB: shortcode,
      PhoneNumber: normalizePhone(phone),
      CallBackURL: `${appUrl()}/api/webhooks/mpesa`,
      AccountReference: invoice.invoiceNumber.slice(0, 12),
      TransactionDesc: `Rent ${invoice.invoiceNumber}`.slice(0, 13),
    }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa STK push failed')
  }
  return {
    checkoutRequestId: String(data.CheckoutRequestID || ''),
    reference: String(data.MerchantRequestID || ''),
    phone: normalizePhone(phone),
  }
}

async function initiatePaystack(params: {
  invoice: { id: string; invoiceNumber: string; amountDue: number; amountPaid: number; tenantUserId: string }
  organizationId: string
  creds: GatewayCredentials
  email: string
}) {
  const { invoice, organizationId, creds, email } = params
  const secret = creds.secretKey
  if (!secret) throw new Error('Paystack gateway is not fully configured (secret key required)')
  const amount = Math.round((invoice.amountDue - invoice.amountPaid) * 100) // kobo/cents
  if (amount <= 0) throw new Error('Invoice has no outstanding balance')

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      amount,
      currency: creds.currency || 'KES',
      callback_url: `${appUrl()}/portal/invoices?paid=1`,
      metadata: { organizationId, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack initialization failed')
  }
  return {
    reference: String(data.data.reference || ''),
    authorizationUrl: String(data.data.authorization_url || ''),
    checkoutRequestId: null,
    phone: null,
  }
}

export type InitiateResult = {
  sessionId: string
  provider: PaymentGatewayProvider
  status: 'pending' | 'instructions'
  message: string
  authorizationUrl?: string | null
}

/**
 * Starts a tenant-initiated invoice payment via the org's configured gateway.
 * Creates a pending PaymentSession; completion happens in the webhook handlers.
 */
export async function initiateInvoicePayment(params: {
  organizationId: string
  invoiceId: string
  provider: PaymentGatewayProvider
  phone?: string
  email?: string
}): Promise<InitiateResult> {
  const { organizationId, invoiceId, provider } = params

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: { id: true, invoiceNumber: true, amountDue: true, amountPaid: true, tenantUserId: true, status: true },
  })
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status === 'paid') throw new Error('Invoice is already paid')

  // One pending session per invoice at a time
  const existing = await prisma.paymentSession.findFirst({
    where: { invoiceId: invoice.id, status: 'pending' },
    select: { id: true },
  })
  if (existing) throw new Error('A payment for this invoice is already pending')

  if (provider === 'bank_transfer') {
    const session = await prisma.paymentSession.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        tenantUserId: invoice.tenantUserId,
        provider,
        amount: invoice.amountDue - invoice.amountPaid,
        status: 'pending',
      },
    })
    return {
      sessionId: session.id,
      provider,
      status: 'instructions',
      message: 'Bank transfer selected. Please use your bank details and quote the invoice number as reference. Your landlord will confirm the payment.',
    }
  }

  const gateway = await prisma.landlordPaymentGateway.findFirst({
    where: { organizationId, provider, isActive: true },
  })
  if (!gateway) throw new Error('This payment method is not configured for this organization')
  const creds = parseGatewayCredentials(gateway.apiCredentialsEncrypted)

  let initiated: { checkoutRequestId: string | null; reference: string | null; authorizationUrl?: string; phone?: string | null }
  if (provider === 'mpesa_paybill' || provider === 'mpesa_till') {
    const phone = params.phone || ''
    if (!phone) throw new Error('M-Pesa phone number is required')
    initiated = await initiateMpesa({ organizationId, invoice, gateway, creds, phone })
  } else if (provider === 'paystack_subaccount') {
    const email = params.email
    if (!email) throw new Error('Email is required for card payment')
    initiated = await initiatePaystack({ invoice, organizationId, creds, email })
  } else {
    throw new Error('Unsupported payment provider')
  }

  const session = await prisma.paymentSession.create({
    data: {
      organizationId,
      invoiceId: invoice.id,
      tenantUserId: invoice.tenantUserId,
      provider,
      checkoutRequestId: initiated.checkoutRequestId,
      reference: initiated.reference,
      phone: initiated.phone || null,
      email: params.email || null,
      amount: invoice.amountDue - invoice.amountPaid,
      currency: creds.currency || 'KES',
      status: 'pending',
      authorizationUrl: initiated.authorizationUrl || null,
    },
  })

  await notifyTelegram('Payment session initiated', {
    event: 'payment_initiated',
    orgId: organizationId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    provider,
    sessionId: session.id,
    amount: session.amount,
  })

  return {
    sessionId: session.id,
    provider,
    status: 'pending',
    message:
      provider === 'mpesa_paybill' || provider === 'mpesa_till'
        ? 'Check your phone and enter your M-Pesa PIN to complete payment.'
        : 'Redirecting to secure card payment…',
    authorizationUrl: initiated.authorizationUrl || null,
  }
}

function invoiceStatus(amountDue: number, amountPaid: number, dueDate: Date): 'unpaid' | 'partial' | 'paid' | 'overdue' {
  if (amountPaid >= amountDue - 0.001) return 'paid'
  if (amountPaid > 0) return 'partial'
  return dueDate < new Date() ? 'overdue' : 'unpaid'
}

/**
 * Applies a confirmed gateway payment: creates the RentPayment, updates the
 * invoice balance/status, and marks the PaymentSession successful.
 * Idempotent via gatewayReference and session status.
 */
export async function applySuccessfulPayment(params: {
  organizationId: string
  invoiceId: string
  amount: number
  paymentMethod: 'mpesa_stk' | 'mpesa_c2b' | 'card' | 'cash_manual' | 'bank_transfer'
  gatewayReference?: string | null
  paidAt?: Date | null
  sessionId?: string | null
}) {
  const { organizationId, invoiceId, amount } = params
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid payment amount')

  return prisma.$transaction(async (tx) => {
    if (params.gatewayReference) {
      const existing = await tx.rentPayment.findFirst({
        where: { organizationId, gatewayReference: params.gatewayReference },
        select: { id: true },
      })
      if (existing) return { duplicate: true as const }
    }

    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId } })
    if (!invoice) return { notFound: true as const }

    const newPaid = invoice.amountPaid + amount
    if (newPaid > invoice.amountDue + 0.01) return { overpaid: true as const, amountDue: invoice.amountDue, amountPaid: invoice.amountPaid }
    await tx.rentPayment.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        tenantUserId: invoice.tenantUserId,
        amount,
        paymentMethod: params.paymentMethod,
        gatewayReference: params.gatewayReference || null,
        paidAt: params.paidAt || new Date(),
      },
    })
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, status: invoiceStatus(invoice.amountDue, newPaid, invoice.dueDate) },
    })
    if (params.sessionId) {
      await tx.paymentSession.updateMany({
        where: { id: params.sessionId, status: 'pending' },
        data: { status: 'success' },
      })
    }
    return { duplicate: false as const, invoiceId: invoice.id, newPaid }
  })
}

export async function markPaymentSession(params: {
  checkoutRequestId?: string | null
  reference?: string | null
  status: 'success' | 'failed'
  failureReason?: string | null
}) {
  const where = params.checkoutRequestId
    ? { checkoutRequestId: params.checkoutRequestId }
    : params.reference
      ? { reference: params.reference }
      : null
  if (!where) return
  await prisma.paymentSession.updateMany({
    where: { ...where, status: 'pending' },
    data: { status: params.status, failureReason: params.failureReason || null },
  })
}

export async function findPaymentSessionByGateway(params: { checkoutRequestId?: string | null; reference?: string | null }) {
  if (params.checkoutRequestId) {
    return prisma.paymentSession.findFirst({ where: { checkoutRequestId: params.checkoutRequestId } })
  }
  if (params.reference) {
    return prisma.paymentSession.findFirst({ where: { reference: params.reference } })
  }
  return null
}
