import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'

export type MaskaniOrg = { id: string; name: string; slug: string; status: string }

export async function resolveMaskaniOrg(orgParam?: string | null) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) redirect('/ducksaas')
    const org = await prisma.organization.findUnique({
      where: { id: orgParam },
      select: { id: true, name: true, slug: true, status: true },
    })
    if (!org) redirect('/ducksaas/organizations')
    const sub = await syncOrganizationSubscription(org.id)
    // Super admins may inspect suspended/expired orgs in Maskani (read-only) for support/reactivation.
    // Non-admin users are still redirected to the suspension page below.
    const fresh = await prisma.organization.findUnique({ where: { id: org.id }, select: { id: true, name: true, slug: true, status: true } })
    const statusLabel = sub.isSuspended ? 'suspended' : sub.isGracePeriod ? 'grace period' : 'active'
    return { session, org: fresh || org, roleLabel: `super_admin (viewing, ${statusLabel})`, orgQuery: `?org=${org.id}`, subscription: sub }
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) redirect('/auth/register')

  const sub = await syncOrganizationSubscription(membership.organization.id)
  // Grace period: allow read-only access; suspended: block portal.
  if (sub.isSuspended) {
    redirect('/maskani/suspended')
  }
  const org = await prisma.organization.findUnique({
    where: { id: membership.organization.id },
    select: { id: true, name: true, slug: true, status: true },
  })
  return { session, org: org || membership.organization, roleLabel: membership.role.replace('_', ' '), orgQuery: '', subscription: sub }
}

/**
 * Server-side authorization helper for Maskani operations.
 * Checks if the current user has the required permission to perform an action.
 *
 * @param permissionKey - The permission key to check (e.g., 'manage_properties')
 * @param organizationId - The organization ID to check permissions for
 * @throws Error if authorization check fails
 */
export async function requireMaskaniPermission(permissionKey: string, organizationId: string) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized: No active session')
  }

  // Super admins have full access to everything
  if (session.user.globalRole === 'super_admin') {
    return
  }

  // Get the user's membership in the organization
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId,
    },
    select: {
      role: true,
      permissions: true,
    },
  })

  if (!membership) {
    throw new Error('Forbidden: You are not a member of this organization')
  }

  // Landlord admins have full access within their organization
  if (membership.role === 'landlord_admin') {
    return
  }

  // Tenants are blocked from all landlord/admin mutations
  if (membership.role === 'tenant') {
    throw new Error('Forbidden: Tenants cannot perform landlord/admin operations')
  }

  // For caretaker and other staff roles, check specific permission
  // The permissions field is expected to be a JSON object like { "manage_properties": true, ... }
  if (membership.permissions) {
    const permissions = membership.permissions as Record<string, boolean>
    if (permissions[permissionKey] === true) {
      return
    }
  }

  throw new Error(`Forbidden: You do not have the required permission: ${permissionKey}`)
}
