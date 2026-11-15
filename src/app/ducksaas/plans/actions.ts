'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.globalRole !== 'super_admin') {
    throw new Error('Unauthorized')
  }
}

function num(v: FormDataEntryValue | null, fallback = 0) {
  const n = Number(v ?? fallback)
  return Number.isFinite(n) ? n : fallback
}

function parseFeatureFlags(raw: string) {
  const text = raw.trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {}
  throw new Error('Feature flags must be valid JSON object (e.g. {"sms_reminders": true})')
}

function readPlanData(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const pricingModel = String(formData.get('pricingModel') || 'flat') === 'per_property' ? 'per_property' : 'flat'
  const currency = String(formData.get('currency') || 'USD').trim().toUpperCase() || 'USD'
  const priceMonthly = Math.max(0, num(formData.get('priceMonthly'), 0))
  const priceYearly = Math.max(0, num(formData.get('priceYearly'), 0))
  const pricePerPropertyMonthly = pricingModel === 'per_property' ? Math.max(0, num(formData.get('pricePerPropertyMonthly'), 0)) : 0
  const pricePerPropertyYearly = pricingModel === 'per_property' ? Math.max(0, num(formData.get('pricePerPropertyYearly'), 0)) : 0
  const includedProperties = pricingModel === 'per_property' ? Math.max(0, Math.floor(num(formData.get('includedProperties'), 0))) : 0
  const maxUnits = Math.max(0, Math.floor(num(formData.get('maxUnits'), 10)))
  const isActive = String(formData.get('isActive') || 'on') === 'on' || String(formData.get('isActive')) === 'true'
  const featureFlags = parseFeatureFlags(String(formData.get('featureFlags') || '{}'))
  if (!name) throw new Error('Plan name is required')
  if (!/^[A-Z]{3,10}$/.test(currency)) throw new Error('Currency must be a valid code (e.g. USD, KES)')
  return {
    name,
    pricingModel,
    currency,
    priceMonthly,
    priceYearly,
    pricePerPropertyMonthly,
    pricePerPropertyYearly,
    includedProperties,
    maxUnits,
    isActive,
    featureFlags: featureFlags as Prisma.InputJsonValue,
  }
}

function revalidate() {
  revalidatePath('/ducksaas/plans')
  revalidatePath('/ducksaas/organizations')
  revalidatePath('/ducksaas')
}

export async function createSubscriptionPlan(formData: FormData) {
  await ensureAdmin()
  const data = readPlanData(formData)
  await prisma.subscriptionPlan.create({ data })
  revalidate()
}

export async function updateSubscriptionPlan(formData: FormData) {
  await ensureAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing plan id')
  const data = readPlanData(formData)
  await prisma.subscriptionPlan.update({ where: { id }, data })
  revalidate()
}

export async function deleteSubscriptionPlan(formData: FormData) {
  await ensureAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing plan id')
  const [inUse, ledger] = await Promise.all([
    prisma.organization.count({ where: { subscriptionPlanId: id } }),
    prisma.saaSSubscriptionLedger.count({ where: { planId: id } }),
  ])
  if (inUse > 0) {
    throw new Error(`Cannot delete: plan is assigned to ${inUse} organization(s). Unassign it from all organizations first (or deactivate it).`)
  }
  await prisma.$transaction(async (tx) => {
    if (ledger > 0) {
      await tx.saaSSubscriptionLedger.deleteMany({ where: { planId: id } })
    }
    await tx.subscriptionPlan.delete({ where: { id } })
  })
  revalidate()
}

export async function toggleSubscriptionPlan(formData: FormData) {
  await ensureAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing plan id')
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id }, select: { isActive: true } })
  if (!plan) throw new Error('Plan not found')
  await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: !plan.isActive } })
  revalidate()
}