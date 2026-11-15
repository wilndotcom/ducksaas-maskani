import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { TenantsManager } from './tenants-manager'

export const instant = false

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)

  const [leases, units, tenants] = await Promise.all([
    prisma.lease.findMany({
      where: { organizationId: org.id },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        unit: { select: { id: true, unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.unit.findMany({
      where: { organizationId: org.id },
      include: { property: { select: { name: true } } },
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: org.id, role: 'tenant' },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    }),
  ])

  return (
    <TenantsManager
      organization={org}
      orgQuery={orgQuery}
      roleLabel={roleLabel}
      leases={leases.map((l) => ({
        id: l.id,
        unitId: l.unitId,
        tenantName: l.tenant.name,
        tenantEmail: l.tenant.email,
        tenantPhone: l.tenant.phone,
        unitLabel: `${l.unit.property.name} - ${l.unit.unitNumber}`,
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        billingDayOfMonth: l.billingDayOfMonth,
        status: l.status as 'active' | 'terminated',
      }))}
      units={units.map((u) => ({ id: u.id, label: `${u.property.name} - ${u.unitNumber} (${u.status})` }))}
      tenants={tenants.map((t) => ({ id: t.user.id, name: t.user.name, email: t.user.email, phone: t.user.phone }))}
    />
  )
}
