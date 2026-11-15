import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getSavedCurrency } from '@/lib/currency'
import { PlansManager } from './plans-manager'

export const instant = false

export default async function PlansPage() {
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [plans, totalOrgs] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { organizations: true, saasSubscriptions: true } },
      },
    }),
    prisma.organization.count(),
  ])

  return <PlansManager plans={plans} totalOrgs={totalOrgs} currency={currency} />
}