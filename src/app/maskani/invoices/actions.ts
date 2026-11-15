'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'
import { sendInvoiceEmail, sendPaymentReceiptEmail } from '@/lib/email'
import { notifyTelegram } from '@/lib/telegram'
import { notifyUser, notifyOrgRoles } from '@/lib/notifications'
import { orgBillingSettings } from '@/lib/org-settings'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.invoices')

function invoiceStatus(amountDue: number, amountPaid: number, dueDate: Date): 'unpaid' | 'partial' | 'paid' | 'overdue' {
  if (amountPaid >= amountDue - 0.001) return 'paid'
  if (amountPaid > 0) return 'partial'
  return dueDate < new Date() ? 'overdue' : 'unpaid'
}

async function getOrgInvoiceSettings(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
  const bs = orgBillingSettings(org?.settings)
  return {
    invoicePrefix: bs.invoicePrefix,
    paymentGraceDays: bs.graceDays,
    partialPayments: bs.partialPayments,
    currency: bs.currency,
  }
}

export async function createInvoice(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_invoices', orgId)
  const leaseId = String(formData.get('leaseId') || '')
  const billingMonth = String(formData.get('billingMonth') || '').trim()
  const amountDue = Number(formData.get('amountDue') || 0)
  const dueDateStr = String(formData.get('dueDate') || '')

  if (!leaseId || !billingMonth || !dueDateStr) throw new Error('Lease, billing month, and due date are required')
  if (!Number.isFinite(amountDue) || amountDue <= 0) throw new Error('Amount due must be greater than 0')
  const dueDate = new Date(dueDateStr)
  if (isNaN(dueDate.getTime())) throw new Error('Invalid due date')

  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId: orgId },
    select: { id: true, unitId: true, tenantUserId: true },
  })
  if (!lease) throw new Error('Lease not found')

  const existing = await prisma.invoice.findFirst({ where: { leaseId: lease.id, billingMonth }, select: { invoiceNumber: true } })
  if (existing) throw new Error(`Invoice ${existing.invoiceNumber} already exists for this lease and billing month`)

  const { invoicePrefix, paymentGraceDays, currency } = await getOrgInvoiceSettings(orgId)
  const effectiveDue = new Date(dueDate)
  if (paymentGraceDays > 0) effectiveDue.setDate(effectiveDue.getDate() + paymentGraceDays)
  const invoiceNumber = `${invoicePrefix}-${Date.now().toString(36).toUpperCase()}`
  const created = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      leaseId: lease.id,
      unitId: lease.unitId,
      tenantUserId: lease.tenantUserId,
      invoiceNumber,
      billingMonth,
      amountDue,
      amountPaid: 0,
      dueDate: effectiveDue,
      status: invoiceStatus(amountDue, 0, effectiveDue),
    },
  })

  const [tenant, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: lease.tenantUserId }, select: { name: true, email: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, settings: true } }),
  ])
  if (tenant?.email) {
    sendInvoiceEmail({
      to: tenant.email,
      name: tenant.name,
      orgName: org?.name || 'your property manager',
      invoiceNumber: created.invoiceNumber,
      amount: amountDue,
      currency,
      dueDate: effectiveDue.toLocaleDateString(),
    }).catch(() => {})
  }
  await notifyUser(lease.tenantUserId, orgId, {
    type: 'invoice',
    title: `New invoice ${created.invoiceNumber}`,
    body: `You have a new invoice for ${amountDue.toLocaleString()} ${currency}.`,
    link: '/portal/invoices',
  }).catch(() => {})

  revalidatePath('/maskani')
  revalidatePath('/maskani/invoices')
}

export async function recordPayment(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('record_payments', orgId)
  const invoiceId = String(formData.get('invoiceId') || '')
  const amount = Number(formData.get('amount') || 0)
  const paymentMethod = String(formData.get('paymentMethod') || 'cash_manual') as 'mpesa_stk' | 'mpesa_c2b' | 'card' | 'cash_manual' | 'bank_transfer'
  const gatewayReference = String(formData.get('gatewayReference') || '').trim() || null
  const paidAtStr = String(formData.get('paidAt') || '')

  if (!invoiceId) throw new Error('Invoice is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than 0')
  if (!['mpesa_stk', 'mpesa_c2b', 'card', 'cash_manual', 'bank_transfer'].includes(paymentMethod)) throw new Error('Invalid payment method')
  const paidAt = paidAtStr ? new Date(paidAtStr) : new Date()
  if (isNaN(paidAt.getTime())) throw new Error('Invalid payment date')

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: orgId } })
  if (!invoice) throw new Error('Invoice not found')
  const newPaid = invoice.amountPaid + amount
  if (newPaid > invoice.amountDue + 0.01) throw new Error('Payment exceeds outstanding balance')
  const { partialPayments } = await getOrgInvoiceSettings(orgId)
  if (!partialPayments && newPaid < invoice.amountDue - 0.01) {
    throw new Error('Partial payments are disabled for this organization')
  }

  const receiptNumber = await prisma.$transaction(async (tx) => {
    const paymentCount = await tx.rentPayment.count({ where: { invoiceId: invoice.id } })
    const receipt = `${invoice.invoiceNumber}-R${String(paymentCount + 1).padStart(3, '0')}`
    await tx.rentPayment.create({
      data: {
        organizationId: orgId,
        invoiceId: invoice.id,
        tenantUserId: invoice.tenantUserId,
        amount,
        paymentMethod,
        gatewayReference,
        receiptNumber: receipt,
        paidAt,
      },
    })
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, status: invoiceStatus(invoice.amountDue, newPaid, invoice.dueDate) },
    })
    await tx.paymentSession.updateMany({
      where: { invoiceId: invoice.id, status: 'pending' },
      data: { status: 'success' },
    })
    return receipt
  })

  const [tenant, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: invoice.tenantUserId }, select: { name: true, email: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, settings: true } }),
  ])
  const { currency } = await getOrgInvoiceSettings(orgId)
  if (tenant?.email) {
    sendPaymentReceiptEmail({
      to: tenant.email,
      tenantName: tenant.name,
      organizationName: org?.name || 'your property manager',
      invoiceNumber: invoice.invoiceNumber,
      amount,
      currency,
      method: paymentMethod,
      paidAt,
    }).catch(() => {})
  }
  await notifyUser(invoice.tenantUserId, orgId, {
    type: 'payment',
    title: `Payment received — ${receiptNumber}`,
    body: `Your payment of ${amount.toLocaleString()} ${currency} for invoice ${invoice.invoiceNumber} was recorded.`,
    link: '/portal/invoices',
  }).catch(() => {})
  await notifyOrgRoles(orgId, ['landlord_admin', 'caretaker'], {
    type: 'payment',
    title: `Payment received — ${receiptNumber}`,
    body: `${tenant?.name || 'A tenant'} paid ${amount.toLocaleString()} ${currency} on invoice ${invoice.invoiceNumber}.`,
    link: '/maskani/invoices',
  }).catch(() => {})
  await notifyTelegram('Payment recorded', {
    event: 'payment_recorded',
    orgId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount,
    method: paymentMethod,
    recordedBy: 'landlord',
  })

  revalidatePath('/maskani')
  revalidatePath('/maskani/invoices')
}
