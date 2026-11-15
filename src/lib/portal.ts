import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import { pickActiveMembership } from '@/lib/maskani'

export type TenantContext = {
  session: Session
  org: { id: string; name: string; slug: string; status: string }
  membership: { id: string; role: string; unitId: string | null }
  unit: { id: string; unitNumber: string; propertyName: string } | null
}

/**
 * Resolves the current tenant's portal context.
 * Requires an OrganizationMember with role 'tenant'. Redirects others appropriately.
 */
export async function resolveTenantContext(): Promise<TenantContext> {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  if (session.user.globalRole === 'super_admin') redirect('/ducksaas')

  const tenantMemberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id, role: 'tenant' },
    include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const membership = await pickActiveMembership(session.user.id, tenantMemberships)
  if (!membership) {
    // Staff/landlord users belong in the Maskani workspace, not the portal.
    const anyMembership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (anyMembership) redirect('/maskani')
    redirect('/auth/register')
  }

  const sub = await syncOrganizationSubscription(membership.organization.id)
  if (sub.isSuspended) redirect('/portal/suspended')

  // Resolve the tenant's unit: explicit member link, else latest active lease.
  let unitId = membership.unitId
  if (!unitId) {
    const lease = await prisma.lease.findFirst({
      where: { organizationId: membership.organization.id, tenantUserId: session.user.id, status: 'active' },
      orderBy: { startDate: 'desc' },
      select: { unitId: true },
    })
    unitId = lease?.unitId || null
  }

  let unit: TenantContext['unit'] = null
  if (unitId) {
    const u = await prisma.unit.findFirst({
      where: { id: unitId, organizationId: membership.organization.id },
      select: { id: true, unitNumber: true, property: { select: { name: true } } },
    })
    if (u) unit = { id: u.id, unitNumber: u.unitNumber, propertyName: u.property.name }
  }

  return {
    session,
    org: membership.organization,
    membership: { id: membership.id, role: membership.role, unitId: membership.unitId },
    unit,
  }
}
