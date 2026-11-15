'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email'
import { generateUniqueUsername } from '@/lib/username'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.tenants')

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

  const tenantName = String(formData.get('tenantName') || '').trim()
  const tenantPhone = String(formData.get('tenantPhone') || '').trim()
  const tenantPassword = String(formData.get('tenantPassword') || '')

  const [unit, existingTenant] = await Promise.all([
    prisma.unit.findFirst({
      where: { id: unitId, organizationId: orgId },
      select: { id: true, status: true, _count: { select: { leases: { where: { status: 'active' } } } } },
    }),
    prisma.user.findUnique({ where: { email: tenantEmail }, select: { id: true } }),
  ])
  if (!unit) throw new Error('Selected unit not found in this organization')
  if (status === 'active') {
    if (unit._count.leases > 0) throw new Error('This unit already has an active lease. Terminate it first.')
    if (unit.status !== 'vacant') throw new Error('This unit is not vacant. Set it to vacant before creating an active lease.')
  }

  let tenant = existingTenant
  let createdTenantAccount = false
  if (!tenant) {
    // No account yet — create one inline so the tenant can sign in to the portal.
    if (!tenantName) throw new Error('Tenant name is required to create a new account')
    if (tenantPassword.length < 8) throw new Error('Password must be at least 8 characters to create a new tenant account')
    const passwordHash = await bcrypt.hash(tenantPassword, 10)
    tenant = await prisma.user.create({
      data: {
        name: tenantName,
        email: tenantEmail,
        username: await generateUniqueUsername({ email: tenantEmail, name: tenantName }),
        phone: tenantPhone || null,
        passwordHash,
        globalRole: 'standard',
      },
      select: { id: true },
    })
    createdTenantAccount = true
  }

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

  if (createdTenantAccount) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    sendWelcomeEmail({
      to: tenantEmail,
      name: tenantName,
      orgName: org?.name || 'your property manager',
      role: 'tenant',
      tempPassword: tenantPassword || undefined,
    }).catch(() => {})
  }

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
  const lease = await prisma.lease.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, unitId: true, endDate: true, unit: { select: { _count: { select: { leases: { where: { status: 'active', id: { not: id } } } } } } } },
  })
  if (!lease) throw new Error('Lease not found')
  if (status === 'active') {
    if (lease.endDate < new Date()) throw new Error('Cannot activate an expired lease. Create a new lease instead.')
    if (lease.unit._count.leases > 0) throw new Error('This unit already has another active lease')
  }
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
