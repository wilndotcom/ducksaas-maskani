'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertOrganizationWritable } from '@/lib/subscription-enforcement'
import { requireMaskaniPermission } from '@/lib/maskani'

async function resolveOrgId(orgParam?: string | null) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) throw new Error('Organization is required')
    const org = await prisma.organization.findUnique({ where: { id: orgParam }, select: { id: true } })
    if (!org) throw new Error('Organization not found')
    await assertOrganizationWritable(org.id)
    return org.id
  }
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) throw new Error('No organization membership found')
  await assertOrganizationWritable(membership.organizationId)
  return membership.organizationId
}

export async function createLease(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_tenants_leases', orgId)
  const unitId = String(formData.get('unitId') || '')
  const tenantEmail = String(formData.get('tenantEmail') || '').trim().toLowerCase()
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')
  const billingDayOfMonth = Number(formData.get('billingDayOfMonth') || 1)
  const status = String(formData.get('status') || 'active') as 'active' | 'terminated'

  if (!unitId || !tenantEmail || !startDate || !endDate) throw new Error('Unit, tenant email, start date, and end date are required')
  if (!['active', 'terminated'].includes(status)) throw new Error('Invalid status')
  if (!Number.isInteger(billingDayOfMonth) || billingDayOfMonth < 1 || billingDayOfMonth > 28) throw new Error('Billing day must be between 1 and 28')
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) throw new Error('Provide valid start/end dates (end must be after start)')

  const [unit, tenant] = await Promise.all([
    prisma.unit.findFirst({ where: { id: unitId, organizationId: orgId }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: tenantEmail }, select: { id: true } }),
  ])
  if (!unit) throw new Error('Selected unit not found in this organization')
  if (!tenant) throw new Error('No user found with that email. Tenant must have an account first.')

  await prisma.$transaction(async (tx) => {
    await tx.lease.create({
      data: {
        organizationId: orgId,
        unitId,
        tenantUserId: tenant.id,
        startDate: start,
        endDate: end,
        billingDayOfMonth,
        status,
      },
    })
    await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: tenant.id } },
      update: { role: 'tenant', unitId },
      create: { organizationId: orgId, userId: tenant.id, role: 'tenant', unitId },
    })
    if (status === 'active') {
      await tx.unit.update({ where: { id: unitId }, data: { status: 'occupied' } })
    }
  })

  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
  revalidatePath('/maskani/properties')
}

export async function updateLeaseStatus(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_tenants_leases', orgId)
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || 'active') as 'active' | 'terminated'
  if (!id || !['active', 'terminated'].includes(status)) throw new Error('Invalid request')
  const lease = await prisma.lease.findFirst({ where: { id, organizationId: orgId }, select: { id: true, unitId: true } })
  if (!lease) throw new Error('Lease not found')
  await prisma.$transaction(async (tx) => {
    await tx.lease.update({ where: { id }, data: { status } })
    if (status === 'terminated') {
      const otherActive = await tx.lease.count({ where: { unitId: lease.unitId, status: 'active', id: { not: id } } })
      if (otherActive === 0) await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'vacant' } })
    } else {
      await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'occupied' } })
    }
  })
  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
  revalidatePath('/maskani/properties')
}

export async function deleteLease(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_tenants_leases', orgId)
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')
  const lease = await prisma.lease.findFirst({ where: { id, organizationId: orgId }, select: { id: true, unitId: true } })
  if (!lease) throw new Error('Lease not found')
  await prisma.$transaction(async (tx) => {
    await tx.lease.delete({ where: { id } })
    const otherActive = await tx.lease.count({ where: { unitId: lease.unitId, status: 'active' } })
    if (otherActive === 0) await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'vacant' } })
  })
  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
  revalidatePath('/maskani/properties')
}
