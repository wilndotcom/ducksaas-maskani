import { prisma } from '@/lib/prisma'
import { OrganizationsManager } from './organizations-manager'
import { headers } from 'next/headers'
import { getRootDomain } from '@/lib/tenant-domain'

export const instant = false

export default async function OrganizationsPage() {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const rootDomain = getRootDomain(host)
  const [orgs, plans, users] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        subscriptionPlan: { select: { id: true, name: true, pricingModel: true, priceMonthly: true, priceYearly: true, pricePerPropertyMonthly: true, pricePerPropertyYearly: true, includedProperties: true } },
        _count: { select: { members: true, properties: true, units: true, leases: true, invoices: true, maintenanceTickets: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true, pricingModel: true, priceMonthly: true, priceYearly: true, pricePerPropertyMonthly: true, pricePerPropertyYearly: true, includedProperties: true, currency: true } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, globalRole: true } }),
  ])

  const data = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    ownerUserId: o.ownerUserId,
    ownerName: o.owner?.name ?? '',
    ownerEmail: o.owner?.email ?? '',
    subscriptionPlanId: o.subscriptionPlanId,
    planName: o.subscriptionPlan?.name ?? null,
    planPricingModel: o.subscriptionPlan?.pricingModel ?? null,
    subscriptionEndsAt: o.subscriptionEndsAt ? o.subscriptionEndsAt.toISOString().slice(0, 10) : '',
    createdAt: o.createdAt.toISOString().slice(0, 10),
    counts: o._count,
  }))

  return <OrganizationsManager organizations={data} plans={plans} users={users} rootDomain={rootDomain} />
}
