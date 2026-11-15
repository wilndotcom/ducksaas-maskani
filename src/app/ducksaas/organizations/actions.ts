'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { provisionOrgFromMaster } from '@/lib/organization-template'
import { calculatePlanAmount, type BillingCycle, type PlanPricing } from '@/lib/saas-billing'
import { generateUniqueUsername } from '@/lib/username'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.globalRole !== 'super_admin') {
    throw new Error('Unauthorized')
  }
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function resolveOwnerId(formData: FormData) {
  const ownerMode = String(formData.get('ownerMode') || 'existing')
  if (ownerMode === 'new') {
    const ownerName = String(formData.get('ownerName') || '').trim()
    const ownerEmail = String(formData.get('ownerEmail') || '').trim().toLowerCase()
    const ownerPhone = String(formData.get('ownerPhone') || '').trim()
    const ownerPassword = String(formData.get('ownerPassword') || '')
    if (!ownerName || !ownerEmail || !ownerPassword) {
      throw new Error('Owner name, email, and password are required for a new owner')
    }
    if (ownerPassword.length < 8) {
      throw new Error('Owner password must be at least 8 characters')
    }
    const existing = await prisma.user.findUnique({ where: { email: ownerEmail } })
    if (existing) {
      throw new Error('A user with this email already exists. Select the existing owner instead.')
    }
    const passwordHash = await bcrypt.hash(ownerPassword, 10)
    const user = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        username: await generateUniqueUsername({ email: ownerEmail, name: ownerName }),
        phone: ownerPhone || null,
        passwordHash,
        globalRole: 'standard',
      },
      select: { id: true },
    })
    return user.id
  }
  const ownerUserId = String(formData.get('ownerUserId') || '').trim()
  if (!ownerUserId) throw new Error('Please select an owner or create a new owner')
  return ownerUserId
}

function cycleFromForm(formData: FormData): BillingCycle {
  return String(formData.get('billingCycle') || 'monthly') === 'yearly' ? 'yearly' : 'monthly'
}

function nextPeriodEnd(start: Date, cycle: BillingCycle) {
  const end = new Date(start)
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  return end
}

export async function createOrganization(formData: FormData) {
  await ensureAdmin()
  const name = String(formData.get('name') || '').trim()
  const status = String(formData.get('status') || 'active') as 'active' | 'grace_period' | 'suspended_readonly'
  let slug = String(formData.get('slug') || '').trim()
  if (!name) throw new Error('Organization name is required')
  if (!slug) slug = slugify(name)
  if (!slug) throw new Error('Slug/subdomain is required')

  const ownerUserId = await resolveOwnerId(formData)

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        slug,
        ownerUserId,
        status,
        subscriptionPlanId: null,
        subscriptionEndsAt: null,
        members: {
          create: { userId: ownerUserId, role: 'landlord_admin' },
        },
      },
      select: { id: true },
    })
    await provisionOrgFromMaster(tx, org.id)
  })
  revalidatePath('/ducksaas/organizations')
  revalidatePath('/ducksaas')
}

export async function updateOrganization(formData: FormData) {
  await ensureAdmin()
  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const slug = String(formData.get('slug') || '').trim()
  const subscriptionPlanId = String(formData.get('subscriptionPlanId') || '').trim() || null
  const status = String(formData.get('status') || 'active') as 'active' | 'grace_period' | 'suspended_readonly'
  const ends = String(formData.get('subscriptionEndsAt') || '').trim()
  const billingCycle = cycleFromForm(formData)
  const recordCharge = String(formData.get('recordCharge') || '') === 'on' || String(formData.get('recordCharge') || '') === 'true'
  const gateway = String(formData.get('paymentGateway') || 'manual_admin').trim() || 'manual_admin'
  const transactionRef = String(formData.get('transactionRef') || '').trim() || `MANUAL-${Date.now().toString(36).toUpperCase()}`
  if (!id || !name || !slug) throw new Error('Missing required fields')

  const ownerUserId = await resolveOwnerId(formData)

  await prisma.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id },
      select: { subscriptionPlanId: true },
    })
    if (!before) throw new Error('Organization not found')

    const periodStart = new Date()
    let periodEnd: Date | null = ends ? new Date(ends) : null
    let ledgerData: {
      organizationId: string
      planId: string
      amount: number
      gateway: string
      transactionRef: string
      status: 'active'
      periodStart: Date
      periodEnd: Date
    } | null = null

    if (subscriptionPlanId) {
      const plan = await tx.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } })
      if (!plan) throw new Error('Subscription plan not found')
      const propertyCount = await tx.property.count({ where: { organizationId: id } })
      const breakdown = calculatePlanAmount(plan as PlanPricing, propertyCount, billingCycle)
      if (!periodEnd || isNaN(periodEnd.getTime())) {
        periodEnd = nextPeriodEnd(periodStart, billingCycle)
      }
      const shouldRecord = recordCharge || before.subscriptionPlanId !== subscriptionPlanId
      if (shouldRecord) {
        ledgerData = {
          organizationId: id,
          planId: plan.id,
          amount: breakdown.amount,
          gateway,
          transactionRef,
          status: 'active' as const,
          periodStart,
          periodEnd,
        }
      }
    }

    await tx.organization.update({
      where: { id },
      data: {
        name,
        slug,
        ownerUserId,
        status,
        subscriptionPlanId,
        subscriptionEndsAt: periodEnd && !isNaN(periodEnd.getTime()) ? periodEnd : null,
      },
    })
    await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: id, userId: ownerUserId } },
      update: { role: 'landlord_admin' },
      create: { organizationId: id, userId: ownerUserId, role: 'landlord_admin' },
    })

    if (ledgerData) {
      await tx.saaSSubscriptionLedger.create({ data: ledgerData })
    }
  })
  revalidatePath('/ducksaas/organizations')
  revalidatePath('/ducksaas')
  revalidatePath('/ducksaas/revenue')
  revalidatePath('/ducksaas/plans')
}

export async function grantTrial(formData: FormData) {
  await ensureAdmin()
  const id = String(formData.get('id') || '')
  const days = Number(formData.get('trialDays')) || Number(process.env.TRIAL_PERIOD_DAYS) || 14
  if (!id) throw new Error('Missing organization id')
  if (!Number.isFinite(days) || days <= 0 || days > 365) throw new Error('Trial days must be between 1 and 365')

  await prisma.organization.update({
    where: { id },
    data: {
      status: 'active',
      subscriptionEndsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  })
  revalidatePath('/ducksaas/organizations')
  revalidatePath('/ducksaas')
}

export async function deleteOrganization(formData: FormData) {
  await ensureAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')
  await prisma.organization.delete({ where: { id } })
  revalidatePath('/ducksaas/organizations')
  revalidatePath('/ducksaas')
  revalidatePath('/ducksaas/revenue')
  revalidatePath('/ducksaas/plans')
}