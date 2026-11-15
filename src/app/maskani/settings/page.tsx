import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { MaskaniSettingsManager } from './maskani-settings-manager'
import { DEFAULT_ADMIN_RIGHTS } from './rights'

export const instant = false

export default async function MaskaniSettingsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)

  const [organization, stats, gateways, adminMembers, users] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      select: { id: true, name: true, slug: true, status: true, ownerUserId: true, subscriptionEndsAt: true, settings: true, owner: { select: { name: true, email: true } }, subscriptionPlan: true },
    }),
    prisma.organization.findUnique({
      where: { id: org.id },
      include: { _count: { select: { properties: true, units: true, members: true, leases: true, invoices: true, maintenanceTickets: true } } },
    }),
    prisma.landlordPaymentGateway.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.organizationMember.findMany({
      where: { organizationId: org.id, role: { in: ['landlord_admin', 'caretaker'] } },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
  ])
  if (!organization || !stats) throw new Error('Organization not found')

  return (
    <MaskaniSettingsManager
      organization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        ownerUserId: organization.ownerUserId,
        subscriptionEndsAt: organization.subscriptionEndsAt ? organization.subscriptionEndsAt.toISOString() : null,
        owner: organization.owner,
        subscriptionPlan: organization.subscriptionPlan
          ? {
              name: organization.subscriptionPlan.name,
              currency: organization.subscriptionPlan.currency,
              priceMonthly: organization.subscriptionPlan.priceMonthly,
              priceYearly: organization.subscriptionPlan.priceYearly,
              maxUnits: organization.subscriptionPlan.maxUnits,
              isActive: organization.subscriptionPlan.isActive,
            }
          : null,
      }}
      orgQuery={orgQuery}
      roleLabel={roleLabel}
      stats={stats._count}
      gateways={gateways.map((g) => ({
        id: g.id,
        provider: g.provider,
        accountNumber: g.accountNumber,
        isActive: g.isActive,
        updatedAt: g.updatedAt.toISOString(),
      }))}
      adminMembers={adminMembers.map((m) => {
        const p = (m.permissions && typeof m.permissions === 'object' && !Array.isArray(m.permissions) ? (m.permissions as Record<string, boolean>) : {}) as Record<string, boolean>
        return {
          id: m.id,
          userId: m.userId,
          role: m.role as 'landlord_admin' | 'caretaker',
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          rights: { ...DEFAULT_ADMIN_RIGHTS, ...p },
        }
      })}
      users={users}
      initialSettings={(organization.settings && typeof organization.settings === 'object' && !Array.isArray(organization.settings) ? organization.settings : {}) as Record<string, unknown>}
    />
  )
}


