import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getSavedCurrency } from '@/lib/currency'
import { TenantsManager } from './tenants-manager'

export const instant = false

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [leases, units, tenants, waterReadings] = await Promise.all([
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
    prisma.waterReading.findMany({
      where: { organizationId: org.id },
      orderBy: { periodMonth: 'desc' },
      take: 200,
      select: { id: true, unitId: true, periodMonth: true, meterReading: true, unitsConsumed: true, ratePerUnit: true, amount: true, invoiceId: true },
    }),
  ])

  // Units that can be billed for water: occupied units on active leases
  const billableUnitIds = new Set(leases.filter((l) => l.status === 'active').map((l) => l.unitId))
  const waterUnits = units
    .filter((u) => billableUnitIds.has(u.id))
    .map((u) => ({ id: u.id, label: `${u.property.name} - ${u.unitNumber}`, rate: u.waterRatePerUnit }))

  return (
    <TenantsManager
      organization={org}
      orgQuery={orgQuery}
      roleLabel={roleLabel}
      currency={currency}
      leases={leases.map((l) => ({
        id: l.id,
        unitId: l.unitId,
        tenantUserId: l.tenantUserId,
        tenantName: l.tenant.name,
        tenantEmail: l.tenant.email,
        tenantPhone: l.tenant.phone,
        unitLabel: `${l.unit.property.name} - ${l.unit.unitNumber}`,
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        billingDayOfMonth: l.billingDayOfMonth,
        status: l.status as 'active' | 'terminated',
      }))}
      units={units.map((u) => ({ id: u.id, label: `${u.property.name} - ${u.unitNumber}${u.status === 'vacant' ? '' : ` (${u.status})`}`, available: u.status === 'vacant' }))}
      tenants={tenants.map((t) => ({ id: t.user.id, name: t.user.name, email: t.user.email, phone: t.user.phone }))}
      waterUnits={waterUnits}
      waterReadings={waterReadings.map((r) => ({ id: r.id, unitId: r.unitId, periodMonth: r.periodMonth, meterReading: r.meterReading, unitsConsumed: r.unitsConsumed, ratePerUnit: r.ratePerUnit, amount: r.amount, billed: r.invoiceId !== null }))}
    />
  )
}
