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

export async function createMaintenanceTicket(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_maintenance', orgId)
  const unitId = String(formData.get('unitId') || '')
  const tenantUserId = String(formData.get('tenantUserId') || '')
  const category = String(formData.get('category') || '') as 'plumbing' | 'electrical' | 'structural' | 'other'
  const priority = String(formData.get('priority') || 'medium') as 'low' | 'medium' | 'high'
  const status = String(formData.get('status') || 'open') as 'open' | 'in_progress' | 'resolved'
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null

  if (!unitId || !tenantUserId || !title) throw new Error('Unit, tenant, and title are required')
  if (!['plumbing', 'electrical', 'structural', 'other'].includes(category)) throw new Error('Invalid category')
  if (!['low', 'medium', 'high'].includes(priority)) throw new Error('Invalid priority')
  if (!['open', 'in_progress', 'resolved'].includes(status)) throw new Error('Invalid status')

  const [unit, tenantMember] = await Promise.all([
    prisma.unit.findFirst({ where: { id: unitId, organizationId: orgId }, select: { id: true } }),
    prisma.organizationMember.findFirst({ where: { organizationId: orgId, userId: tenantUserId }, select: { userId: true } }),
  ])
  if (!unit) throw new Error('Selected unit not found in this organization')
  if (!tenantMember) throw new Error('Selected tenant is not a member of this organization')

  await prisma.maintenanceTicket.create({
    data: { organizationId: orgId, unitId, tenantUserId, category, title, description, priority, status },
  })
  revalidatePath('/maskani')
  revalidatePath('/maskani/maintenance')
}

export async function updateMaintenanceStatus(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_maintenance', orgId)
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '') as 'open' | 'in_progress' | 'resolved'
  if (!id || !['open', 'in_progress', 'resolved'].includes(status)) throw new Error('Invalid request')
  const res = await prisma.maintenanceTicket.updateMany({ where: { id, organizationId: orgId }, data: { status } })
  if (res.count === 0) throw new Error('Ticket not found')
  revalidatePath('/maskani')
  revalidatePath('/maskani/maintenance')
}

export async function deleteMaintenanceTicket(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_maintenance', orgId)
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')
  const res = await prisma.maintenanceTicket.deleteMany({ where: { id, organizationId: orgId } })
  if (res.count === 0) throw new Error('Ticket not found')
  revalidatePath('/maskani')
  revalidatePath('/maskani/maintenance')
}
