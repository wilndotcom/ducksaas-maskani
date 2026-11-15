'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initiateInvoicePayment, type InitiateResult } from '@/lib/payments'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import type { PaymentGatewayProvider } from '@prisma/client'

async function requireTenant() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, role: 'tenant' },
    select: { organizationId: true, unitId: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) throw new Error('No tenant membership found')
  return { session, membership }
}

async function assertOrgOperational(organizationId: string) {
  const sub = await syncOrganizationSubscription(organizationId)
  if (sub.isSuspended) throw new Error('This organization\'s portal is suspended. Please contact your landlord.')
}

async function tenantUnitId(organizationId: string, userId: string, memberUnitId: string | null) {
  if (memberUnitId) return memberUnitId
  const lease = await prisma.lease.findFirst({
    where: { organizationId, tenantUserId: userId, status: 'active' },
    orderBy: { startDate: 'desc' },
    select: { unitId: true },
  })
  return lease?.unitId || null
}

export async function tenantPayInvoice(input: {
  invoiceId: string
  provider: PaymentGatewayProvider
  phone?: string
  email?: string
}): Promise<InitiateResult> {
  const { session, membership } = await requireTenant()
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, organizationId: membership.organizationId, tenantUserId: session.user.id },
    select: { id: true },
  })
  if (!invoice) throw new Error('Invoice not found')
  return initiateInvoicePayment({
    organizationId: membership.organizationId,
    invoiceId: invoice.id,
    provider: input.provider,
    phone: input.phone,
    email: input.email || session.user.email || undefined,
  })
}

export async function tenantCreateTicket(formData: FormData) {
  const { session, membership } = await requireTenant()
  await assertOrgOperational(membership.organizationId)
  const unitId = await tenantUnitId(membership.organizationId, session.user.id, membership.unitId)
  if (!unitId) throw new Error('No unit is assigned to your account yet')

  const category = String(formData.get('category') || '') as 'plumbing' | 'electrical' | 'structural' | 'other'
  const priority = String(formData.get('priority') || 'medium') as 'low' | 'medium' | 'high'
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null

  if (!title) throw new Error('Title is required')
  if (!['plumbing', 'electrical', 'structural', 'other'].includes(category)) throw new Error('Invalid category')
  if (!['low', 'medium', 'high'].includes(priority)) throw new Error('Invalid priority')

  await prisma.maintenanceTicket.create({
    data: {
      organizationId: membership.organizationId,
      unitId,
      tenantUserId: session.user.id,
      category,
      priority,
      title,
      description,
      status: 'open',
    },
  })
  revalidatePath('/portal/maintenance')
}

export async function tenantCreateComplaint(formData: FormData) {
  const { session, membership } = await requireTenant()
  await assertOrgOperational(membership.organizationId)
  const unitId = await tenantUnitId(membership.organizationId, session.user.id, membership.unitId)

  const subject = String(formData.get('subject') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const priority = String(formData.get('priority') || 'medium') as 'low' | 'medium' | 'high'

  if (!subject || !description) throw new Error('Subject and description are required')
  if (!['low', 'medium', 'high'].includes(priority)) throw new Error('Invalid priority')

  await prisma.complaint.create({
    data: {
      organizationId: membership.organizationId,
      tenantUserId: session.user.id,
      unitId,
      subject,
      description,
      priority,
      status: 'open',
    },
  })
  revalidatePath('/portal/complaints')
}
