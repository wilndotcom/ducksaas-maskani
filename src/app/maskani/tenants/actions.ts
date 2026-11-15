'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email'
import { generateUniqueUsername } from '@/lib/username'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'
import { notifyUser, notifyOrgRoles } from '@/lib/notifications'
import { orgBillingSettings } from '@/lib/org-settings'

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

  const [unit, existingTenant, org] = await Promise.all([
    prisma.unit.findFirst({
      where: { id: unitId, organizationId: orgId },
      select: { id: true, status: true, depositAmount: true, _count: { select: { leases: { where: { status: 'active' } } } } },
    }),
    prisma.user.findUnique({ where: { email: tenantEmail }, select: { id: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, settings: true } }),
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

  const bs = orgBillingSettings(org?.settings)
  const depositAmount = unit.depositAmount || 0
  const hasDeposit = depositAmount > 0
  const invoicePrefix = bs.invoicePrefix

  await prisma.$transaction(async (tx) => {
    const newLease = await tx.lease.create({
      data: {
        organizationId: orgId,
        unitId,
        tenantUserId: tenant.id,
        startDate: start,
        endDate: end,
        billingDayOfMonth,
        status,
        depositAmount,
        depositStatus: hasDeposit ? 'invoiced' : 'collected',
      },
    })
    // Security deposit invoice — one-off, due at move-in
    if (hasDeposit) {
      await tx.invoice.create({
        data: {
          organizationId: orgId,
          leaseId: newLease.id,
          unitId,
          tenantUserId: tenant.id,
          invoiceNumber: `${invoicePrefix}-DEP-${newLease.id.slice(-6).toUpperCase()}`,
          billingMonth: 'move-in',
          amountDue: depositAmount,
          amountPaid: 0,
          dueDate: start,
          status: start < new Date() ? 'overdue' : 'unpaid',
        },
      })
    }
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
    sendWelcomeEmail({
      to: tenantEmail,
      name: tenantName,
      orgName: org?.name || 'your property manager',
      role: 'tenant',
      tempPassword: tenantPassword || undefined,
    }).catch(() => {})
  }
  if (hasDeposit) {
    await notifyUser(tenant.id, orgId, {
      type: 'invoice',
      title: 'Security deposit invoice',
      body: `A deposit of ${depositAmount.toLocaleString()} ${bs.currency} is due for your new lease.`,
      link: '/portal/invoices',
    }).catch(() => {})
  }
  await notifyOrgRoles(orgId, ['landlord_admin'], {
    type: 'lease',
    title: `New lease — ${tenantEmail}`,
    body: `A lease was created on unit ${unitId.slice(-4)} starting ${startDate}.`,
    link: '/maskani/tenants',
  }).catch(() => {})

  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
  revalidatePath('/maskani/properties')
}

/**
 * Transfers a tenant from their current unit to another unit (same or
 * different property) atomically: terminates the old lease, creates a new
 * active lease on the target unit, moves the member's unit pointer, and
 * updates both units' occupancy. Invoice and water-reading history stays
 * attached to the old lease/unit.
 */
export async function transferLease(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_tenants_leases', orgId)
  const leaseId = String(formData.get('leaseId') || '')
  const newUnitId = String(formData.get('newUnitId') || '')
  const transferDateStr = String(formData.get('transferDate') || '')
  const newEndDateStr = String(formData.get('newEndDate') || '')
  const billingDayRaw = String(formData.get('billingDayOfMonth') || '').trim()

  if (!leaseId || !newUnitId || !transferDateStr || !newEndDateStr) throw new Error('Lease, new unit, transfer date, and new end date are required')

  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId: orgId },
    select: {
      id: true, unitId: true, tenantUserId: true, status: true, billingDayOfMonth: true, depositAmount: true,
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
  })
  if (!lease) throw new Error('Lease not found')
  if (lease.status !== 'active') throw new Error('Only active leases can be transferred')
  if (lease.unitId === newUnitId) throw new Error('Tenant is already on this unit')

  const billingDayOfMonth = billingDayRaw ? Number(billingDayRaw) : lease.billingDayOfMonth
  if (!Number.isInteger(billingDayOfMonth) || billingDayOfMonth < 1 || billingDayOfMonth > 28) throw new Error('Billing day must be between 1 and 28')

  const transferDate = new Date(transferDateStr)
  const newEnd = new Date(newEndDateStr)
  if (isNaN(transferDate.getTime()) || isNaN(newEnd.getTime()) || newEnd <= transferDate) throw new Error('Provide valid dates (end must be after transfer date)')

  const newUnit = await prisma.unit.findFirst({
    where: { id: newUnitId, organizationId: orgId },
    select: { id: true, status: true, depositAmount: true, _count: { select: { leases: { where: { status: 'active' } } } } },
  })
  if (!newUnit) throw new Error('Target unit not found in this organization')
  if (newUnit._count.leases > 0) throw new Error('Target unit already has an active lease')
  if (newUnit.status !== 'vacant') throw new Error('Target unit is not vacant')

  // Deposit carries over; only the difference to the new unit's deposit is billed
  const newDeposit = newUnit.depositAmount || 0
  const depositDiff = Math.max(0, Math.round((newDeposit - (lease.depositAmount || 0)) * 100) / 100)
  const invoicePrefix = orgBillingSettings((await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } }))?.settings).invoicePrefix

  await prisma.$transaction(async (tx) => {
    await tx.lease.update({ where: { id: lease.id }, data: { status: 'terminated', endDate: transferDate } })
    const newLease = await tx.lease.create({
      data: {
        organizationId: orgId,
        unitId: newUnitId,
        tenantUserId: lease.tenantUserId,
        startDate: transferDate,
        endDate: newEnd,
        billingDayOfMonth,
        status: 'active',
        depositAmount: newDeposit,
        depositStatus: depositDiff > 0 ? 'invoiced' : 'collected',
      },
    })
    if (depositDiff > 0) {
      await tx.invoice.create({
        data: {
          organizationId: orgId,
          leaseId: newLease.id,
          unitId: newUnitId,
          tenantUserId: lease.tenantUserId,
          invoiceNumber: `${invoicePrefix}-DEP-${newLease.id.slice(-6).toUpperCase()}`,
          billingMonth: 'move-in',
          amountDue: depositDiff,
          amountPaid: 0,
          dueDate: transferDate,
          status: transferDate < new Date() ? 'overdue' : 'unpaid',
        },
      })
    }
    await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: lease.tenantUserId } },
      update: { unitId: newUnitId },
      create: { organizationId: orgId, userId: lease.tenantUserId, role: 'tenant', unitId: newUnitId },
    })
    const otherActive = await tx.lease.count({ where: { unitId: lease.unitId, status: 'active' } })
    if (otherActive === 0) await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'vacant' } })
    await tx.unit.update({ where: { id: newUnitId }, data: { status: 'occupied' } })
  })

  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
  revalidatePath('/maskani/properties')
  revalidatePath('/portal')
}

/** Move a lease's security deposit through its lifecycle: collected → refunded/forfeited. */
export async function updateDepositStatus(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_tenants_leases', orgId)
  const leaseId = String(formData.get('leaseId') || '')
  const depositStatus = String(formData.get('depositStatus') || '')
  if (!leaseId || !['collected', 'refunded', 'forfeited'].includes(depositStatus)) throw new Error('Invalid deposit status')
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId: orgId },
    select: { id: true, tenantUserId: true, depositAmount: true },
  })
  if (!lease) throw new Error('Lease not found')
  if (lease.depositAmount <= 0) throw new Error('This lease has no deposit')
  await prisma.lease.update({ where: { id: leaseId }, data: { depositStatus } })
  const label = depositStatus === 'collected' ? 'collected' : depositStatus === 'refunded' ? 'refunded to the tenant' : 'forfeited'
  await notifyUser(lease.tenantUserId, orgId, {
    type: 'lease',
    title: `Security deposit ${label}`,
    body: `Your security deposit of ${lease.depositAmount.toLocaleString()} has been ${label}.`,
    link: '/portal',
  }).catch(() => {})
  revalidatePath('/maskani/tenants')
  revalidatePath('/maskani/tenants/[userId]', 'page')
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
