import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { headers, cookies } from 'next/headers'
import { getTenantHost } from '@/lib/tenant-domain'
import { getSavedCurrency } from '@/lib/currency'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import { PropertiesManager } from './properties-manager'

export const instant = false

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await getServerSession(authOptions)
  const { org: orgParam } = await searchParams

  if (!session) {
    redirect('/auth/signin')
  }

  let org
  let roleLabel = ''

  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) {
      redirect('/ducksaas')
    }
    org = await prisma.organization.findUnique({
      where: { id: orgParam },
      select: { id: true, name: true, slug: true, status: true },
    })
    if (!org) {
      redirect('/ducksaas/organizations')
    }
    roleLabel = 'super_admin (viewing)'
  } else {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) {
      redirect('/auth/register')
    }
    org = membership.organization
    roleLabel = membership.role.replace('_', ' ')
    const sub = await syncOrganizationSubscription(org.id)
    if (sub.isSuspended) redirect('/maskani/suspended')
  }

  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const tenantHost = getTenantHost(org.slug, host)
  const orgQuery = orgParam && session.user.globalRole === 'super_admin' ? `?org=${org.id}` : ''
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const properties = await prisma.property.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' },
    include: {
      units: {
        orderBy: { unitNumber: 'asc' },
        select: { id: true, unitNumber: true, floor: true, monthlyRent: true, depositAmount: true, status: true, propertyId: true },
      },
    },
  })

  const data = properties.map((p) => ({
    id: p.id,
    name: p.name,
    location: p.location,
    type: p.type as 'Apartment' | 'Court' | 'Commercial',
    totalUnits: p.totalUnits,
    units: p.units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      floor: u.floor,
      monthlyRent: u.monthlyRent,
      depositAmount: u.depositAmount,
      status: u.status as 'vacant' | 'occupied' | 'maintenance',
      propertyId: u.propertyId,
    })),
  }))

  return (
    <PropertiesManager
      organization={{ id: org.id, name: org.name, status: org.status, tenantHost }}
      orgQuery={orgQuery}
      roleLabel={roleLabel}
      properties={data}
      currency={currency}
    />
  )
}
