'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { ADMIN_RIGHT_KEYS } from './rights'
import { assertOrganizationWritable } from '@/lib/subscription-enforcement'
import { requireMaskaniPermission } from '@/lib/maskani'
import { sendWelcomeEmail } from '@/lib/email'
import { generateUniqueUsername } from '@/lib/username'
import { initiateSubscriptionPayment, type SubscriptionInitiateResult } from '@/lib/platform-billing'
import type { BillingCycle } from '@/lib/saas-billing'
import { Prisma } from '@prisma/client'

async function resolveOrgContext(orgParam?: string | null) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) throw new Error('Organization is required')
    const org = await prisma.organization.findUnique({ where: { id: orgParam }, select: { id: true, ownerUserId: true } })
    if (!org) throw new Error('Organization not found')
    await assertOrganizationWritable(org.id, 'maskani.settings')
    return { orgId: org.id, ownerUserId: org.ownerUserId }
  }
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, role: { in: ['landlord_admin', 'caretaker'] } },
    select: { organizationId: true, organization: { select: { ownerUserId: true } } },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) throw new Error('No authorized organization membership found')
  await assertOrganizationWritable(membership.organizationId, 'maskani.settings')
  return { orgId: membership.organizationId, ownerUserId: membership.organization.ownerUserId }
}

function parseRights(formData: FormData): Record<string, boolean> {
  const rights: Record<string, boolean> = {}
  for (const key of ADMIN_RIGHT_KEYS) {
    rights[key] = formData.get(`right_${key}`) === 'on' || formData.get(`right_${key}`) === 'true'
  }
  return rights
}

export async function addOrganizationAdmin(formData: FormData) {
  const { orgId } = await resolveOrgContext(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_settings', orgId)
  const mode = String(formData.get('mode') || 'existing')
  const role = String(formData.get('role') || 'landlord_admin') as 'landlord_admin' | 'caretaker'
  if (!['landlord_admin', 'caretaker'].includes(role)) throw new Error('Invalid role')
  const permissions = parseRights(formData)

  let userId = String(formData.get('userId') || '').trim()
  let newUserEmail: string | null = null
  let newUserName: string | null = null
  let newUserPassword: string | null = null

  if (mode === 'new') {
    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const phone = String(formData.get('phone') || '').trim()
    const password = String(formData.get('password') || '')
    if (!name || !email || !password) throw new Error('Name, email, and password are required for a new administrator')
    if (password.length < 8) throw new Error('Password must be at least 8 characters')
    newUserEmail = email
    newUserName = name
    newUserPassword = password
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      const existingMember = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: existing.id } } })
      if (existingMember) throw new Error('This user is already a member of the organization')
      userId = existing.id
      // Existing account — no welcome email needed
      newUserEmail = null
    } else {
      const passwordHash = await bcrypt.hash(password, 10)
      const created = await prisma.user.create({
        data: { name, email, username: await generateUniqueUsername({ email, name }), phone: phone || null, passwordHash, globalRole: 'standard' },
        select: { id: true },
      })
      userId = created.id
    }
  } else {
    if (!userId) throw new Error('Please select an existing user')
    const existingMember = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId } } })
    if (existingMember) throw new Error('This user is already a member of the organization')
  }

  await prisma.organizationMember.create({
    data: { organizationId: orgId, userId, role, permissions },
  })

  if (mode === 'new' && newUserEmail && newUserName) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    sendWelcomeEmail({
      to: newUserEmail,
      name: newUserName,
      orgName: org?.name || 'your organization',
      role,
      tempPassword: newUserPassword || undefined,
    }).catch(() => {})
  }

  revalidatePath('/maskani')
  revalidatePath('/maskani/settings')
  revalidatePath('/maskani/tenants')
}

export async function updateOrganizationAdmin(formData: FormData) {
  const { orgId, ownerUserId } = await resolveOrgContext(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_settings', orgId)
  const memberId = String(formData.get('memberId') || '')
  const role = String(formData.get('role') || 'landlord_admin') as 'landlord_admin' | 'caretaker'
  if (!memberId) throw new Error('Missing member')
  if (!['landlord_admin', 'caretaker'].includes(role)) throw new Error('Invalid role')
  const permissions = parseRights(formData)

  const member = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId: orgId }, select: { id: true, userId: true } })
  if (!member) throw new Error('Member not found')
  if (member.userId === ownerUserId && role !== 'landlord_admin') throw new Error('Organization owner must remain a landlord admin')

  await prisma.organizationMember.update({
    where: { id: memberId },
    data: { role, permissions },
  })

  revalidatePath('/maskani')
  revalidatePath('/maskani/settings')
  revalidatePath('/maskani/tenants')
}

export async function removeOrganizationAdmin(formData: FormData) {
  const { orgId, ownerUserId } = await resolveOrgContext(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_settings', orgId)
  const memberId = String(formData.get('memberId') || '')
  if (!memberId) throw new Error('Missing member')
  const member = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId: orgId }, select: { id: true, userId: true, role: true } })
  if (!member) throw new Error('Member not found')
  if (member.userId === ownerUserId) throw new Error('Cannot remove the organization owner')
  if (member.role === 'tenant') throw new Error('Cannot remove tenant from this section')

  await prisma.organizationMember.delete({ where: { id: memberId } })
  revalidatePath('/maskani')
  revalidatePath('/maskani/settings')
  revalidatePath('/maskani/tenants')
}

export async function getOrganizationSettings(organizationId: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  // Ensure caller is a member or super_admin with access
  if (session.user.globalRole !== 'super_admin') {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId: session.user.id },
      select: { id: true },
    })
    if (!membership) throw new Error('Unauthorized')
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  if (!org) throw new Error('Organization not found')

  return (org.settings as Record<string, unknown>) || {}
}

export async function updateOrganizationSettings(organizationId: string, settings: Record<string, unknown>) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  await requireMaskaniPermission('manage_settings', organizationId)
  await assertOrganizationWritable(organizationId, 'maskani.settings')

  const safe = { ...(settings || {}) }
  // Enforce feature flag: disable advanced_reports if plan/toggle policy requires? Keep stored; runtime may gate UI.

  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: safe as Prisma.InputJsonValue },
  })

  revalidatePath('/maskani')
  revalidatePath('/maskani/settings')
  revalidatePath('/maskani/invoices')
}

/**
 * Lets an org admin/owner purchase or renew the organization's subscription
 * plan online (Paystack card or M-Pesa STK via platform credentials).
 */
export async function subscribeToPlan(input: {
  orgId: string
  planId: string
  billingCycle: 'monthly' | 'yearly'
  phone?: string
}): Promise<SubscriptionInitiateResult> {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const orgId = String(input.orgId || '')
  if (!orgId) throw new Error('Organization is required')

  if (session.user.globalRole !== 'super_admin') {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: orgId },
      select: { role: true },
    })
    if (!membership || membership.role === 'tenant') {
      throw new Error('Forbidden: only organization admins can manage billing')
    }
  }

  await assertOrganizationWritable(orgId, 'maskani.subscription')
  await requireMaskaniPermission('manage_settings', orgId)

  const billingCycle: BillingCycle = input.billingCycle === 'yearly' ? 'yearly' : 'monthly'
  return initiateSubscriptionPayment({
    organizationId: orgId,
    planId: String(input.planId || ''),
    billingCycle,
    phone: input.phone,
    email: session.user.email || undefined,
  })
}

export async function fetchOrganizationSettings(organizationId: string) {
  await requireMaskaniPermission('manage_settings', organizationId)
  return getOrganizationSettings(organizationId)
}