'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'
import { sendInvoiceEmail } from '@/lib/email'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.invoices')

function invoiceStatus(amountDue: number, amountPaid: number, dueDate: Date): 'unpaid' | 'partial' | 'paid' | 'overdue' {
  if (amountPaid >= amountDue - 0.001) return 'paid'
  if (amountPaid > 0) return 'partial'
  return dueDate < new Date() ? 'overdue' : 'unpaid'
}

async function getOrgInvoiceSettings(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
  const s = (org?.settings as Record<string, unknown>) || {}
  return {
    invoicePrefix: String(s.invoice_prefix || 'INV').replace(/[^A-Za-z0-9-]/g, '').slice(0, 10) || 'INV',
    paymentGraceDays: Number.isFinite(Number(s.payment_grace_days)) ? Math.max(0, Math.min(60, Number(s.payment_grace_days))) : 0,
    partialPayments: s.partial_payments !== false,
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

  const { invoicePrefix, paymentGraceDays } = await getOrgInvoiceSettings(orgId)
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
    const orgSettings = (org?.settings as Record<string, unknown>) || {}
    sendInvoiceEmail({
      to: tenant.email,
      name: tenant.name,
      orgName: org?.name || 'your property manager',
      invoiceNumber: created.invoiceNumber,
      amount: amountDue,
      currency: String(orgSettings.currency || 'KES'),
      dueDate: effectiveDue.toLocaleDateString(),
    }).catch(() => {})
  }

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

  await prisma.$transaction(async (tx) => {
    await tx.rentPayment.create({
      data: {
        organizationId: orgId,
        invoiceId: invoice.id,
        tenantUserId: invoice.tenantUserId,
        amount,
        paymentMethod,
        gatewayReference,
        paidAt,
      },
    })
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, status: invoiceStatus(invoice.amountDue, newPaid, invoice.dueDate) },
    })
  })
  revalidatePath('/maskani')
  revalidatePath('/maskani/invoices')
}
