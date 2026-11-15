import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { MaintenanceManager } from './maintenance-manager'

export const instant = false

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)

  const [tickets, units, members] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      where: { organizationId: org.id },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.unit.findMany({
      where: { organizationId: org.id },
      include: { property: { select: { name: true } } },
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return (
    <MaintenanceManager
      organization={org}
      orgQuery={orgQuery}
      roleLabel={roleLabel}
      tickets={tickets.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority as 'low' | 'medium' | 'high',
        status: t.status as 'open' | 'in_progress' | 'resolved',
        tenantName: t.tenant.name,
        tenantEmail: t.tenant.email,
        unitLabel: `${t.unit.property.name} - ${t.unit.unitNumber}`,
        createdAt: t.createdAt.toISOString().slice(0, 10),
      }))}
      units={units.map((u) => ({ id: u.id, label: `${u.property.name} - ${u.unitNumber}` }))}
      members={members.map((m) => ({ id: m.user.id, label: `${m.user.name} (${m.user.email})` }))}
    />
  )
}
