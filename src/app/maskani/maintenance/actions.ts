'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'
import { notifyUser } from '@/lib/notifications'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.maintenance')

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

  // High-priority or structural issues flag the unit as under maintenance so
  // it isn't re-leased until the ticket is resolved.
  const needsMaintenance = priority === 'high' || category === 'structural'
  await prisma.$transaction(async (tx) => {
    await tx.maintenanceTicket.create({
      data: { organizationId: orgId, unitId, tenantUserId, category, title, description, priority, status },
    })
    if (needsMaintenance) {
      await tx.unit.updateMany({
        where: { id: unitId, status: { in: ['vacant', 'occupied'] } },
        data: { status: 'maintenance' },
      })
    }
  })
  await notifyUser(tenantUserId, orgId, {
    type: 'ticket',
    title: `Maintenance request logged — ${title}`,
    body: `Priority: ${priority}. Track progress under Maintenance in your portal.`,
    link: '/portal/maintenance',
  }).catch(() => {})
  revalidatePath('/maskani')
  revalidatePath('/maskani/maintenance')
  revalidatePath('/maskani/properties')
}

export async function updateMaintenanceStatus(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_maintenance', orgId)
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '') as 'open' | 'in_progress' | 'resolved'
  if (!id || !['open', 'in_progress', 'resolved'].includes(status)) throw new Error('Invalid request')
  const ticket = await prisma.maintenanceTicket.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, unitId: true, tenantUserId: true },
  })
  if (!ticket) throw new Error('Ticket not found')
  await prisma.$transaction(async (tx) => {
    await tx.maintenanceTicket.update({ where: { id }, data: { status } })
    if (status === 'resolved') {
      // Restore the unit once no other open tickets remain against it
      const remaining = await tx.maintenanceTicket.count({ where: { unitId: ticket.unitId, status: { not: 'resolved' } } })
      if (remaining === 0) {
        const activeLease = await tx.lease.count({ where: { unitId: ticket.unitId, status: 'active' } })
        await tx.unit.update({ where: { id: ticket.unitId }, data: { status: activeLease > 0 ? 'occupied' : 'vacant' } })
      }
    }
  })
  if (status === 'resolved') {
    await notifyUser(ticket.tenantUserId, orgId, {
      type: 'ticket',
      title: 'Maintenance request resolved',
      body: 'Your maintenance request has been marked resolved. Contact your landlord if the issue persists.',
      link: '/portal/maintenance',
    }).catch(() => {})
  }
  revalidatePath('/maskani')
  revalidatePath('/maskani/maintenance')
  revalidatePath('/maskani/properties')
  revalidatePath('/portal/maintenance')
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
