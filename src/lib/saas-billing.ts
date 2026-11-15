import { prisma } from './prisma'

export type PricingModel = 'flat' | 'per_property'
export type BillingCycle = 'monthly' | 'yearly'

export type PlanPricing = {
  pricingModel: string
  priceMonthly: number
  priceYearly: number
  pricePerPropertyMonthly: number
  pricePerPropertyYearly: number
  includedProperties: number
}

export function normalizePricingModel(model?: string | null): PricingModel {
  return model === 'per_property' ? 'per_property' : 'flat'
}

export function calculatePlanAmount(
  plan: PlanPricing,
  propertyCount: number,
  cycle: BillingCycle,
): { amount: number; base: number; extraProperties: number; perProperty: number; totalProperties: number } {
  const totalProperties = Math.max(0, Number.isFinite(propertyCount) ? propertyCount : 0)
  const model = normalizePricingModel(plan.pricingModel)
  const base = cycle === 'yearly' ? Number(plan.priceYearly || 0) : Number(plan.priceMonthly || 0)
  if (model === 'flat') {
    return { amount: Math.max(0, base), base: Math.max(0, base), extraProperties: 0, perProperty: 0, totalProperties }
  }
  const included = Math.max(0, Number(plan.includedProperties || 0))
  const extraProperties = Math.max(0, totalProperties - included)
  const perProperty = cycle === 'yearly' ? Number(plan.pricePerPropertyYearly || 0) : Number(plan.pricePerPropertyMonthly || 0)
  const amount = Math.max(0, base + extraProperties * Math.max(0, perProperty))
  return { amount, base: Math.max(0, base), extraProperties, perProperty: Math.max(0, perProperty), totalProperties }
}

export async function calculateOrgPlanCharge(organizationId: string, cycle: BillingCycle) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      subscriptionPlanId: true,
      subscriptionPlan: true,
      _count: { select: { properties: true } },
    },
  })
  if (!org) throw new Error('Organization not found')
  if (!org.subscriptionPlanId || !org.subscriptionPlan) {
    throw new Error('Organization has no subscription plan assigned')
  }
  const breakdown = calculatePlanAmount(org.subscriptionPlan as PlanPricing, org._count.properties, cycle)
  return { org, plan: org.subscriptionPlan, ...breakdown }
}

export function describePricing(plan: PlanPricing) {
  const model = normalizePricingModel(plan.pricingModel)
  if (model === 'flat') {
    return 'Fixed price for all properties (subject to plan limits).'
  }
  const included = Math.max(0, Number(plan.includedProperties || 0))
  return `Base price includes ${included} ${included === 1 ? 'property' : 'properties'}; each additional property is charged per-property.`
}