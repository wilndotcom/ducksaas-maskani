import { prisma } from './prisma'
import { notifyTelegram } from './telegram'
import type { OrganizationStatus } from '@prisma/client'

export type OrgSubscriptionState = {
  status: OrganizationStatus | string
  subscriptionEndsAt: Date | null
  isExpired: boolean
  isSuspended: boolean
  isReadOnly: boolean
  isGracePeriod: boolean
  canWrite: boolean
}

function isPast(date: Date | null | undefined) {
  return !!date && date.getTime() < Date.now()
}

async function orgMeta(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, status: true, subscriptionEndsAt: true },
  })
}

/**
 * Syncs organization subscription status with expiry.
 * - any non-suspended org past subscriptionEndsAt -> suspended_readonly (no grace period)
 * - 'grace_period' remains available as a manual admin-set read-only status
 */
export async function syncOrganizationSubscription(organizationId: string): Promise<OrgSubscriptionState> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true, subscriptionEndsAt: true, name: true, slug: true },
  })
  if (!org) throw new Error('Organization not found')

  let status: OrganizationStatus = org.status
  const expired = isPast(org.subscriptionEndsAt)
  let autoChanged = false

  if (expired && status !== 'suspended_readonly') {
    status = 'suspended_readonly'
    await prisma.organization.update({ where: { id: org.id }, data: { status } })
    autoChanged = true
  }

  if (autoChanged) {
    await notifyTelegram('Organization auto-suspended (subscription expired)', {
      orgId: org.id,
      name: org.name,
      slug: org.slug,
      status,
      subscriptionEndsAt: org.subscriptionEndsAt?.toISOString() ?? null,
      event: 'auto_suspended',
    })
  }

  const isSuspended = status === 'suspended_readonly'
  const isGracePeriod = status === 'grace_period'
  const isReadOnly = isSuspended || isGracePeriod
  const canWrite = status === 'active' && !expired

  return {
    status,
    subscriptionEndsAt: org.subscriptionEndsAt,
    isExpired: expired,
    isSuspended,
    isReadOnly,
    isGracePeriod,
    canWrite,
  }
}

export async function assertOrganizationWritable(organizationId: string, context?: string) {
  const state = await syncOrganizationSubscription(organizationId)
  if (!state.canWrite) {
    const org = await orgMeta(organizationId)
    const reason = state.isSuspended
      ? 'Organization subscription is expired/suspended. Portal access is disabled until renewed.'
      : state.isGracePeriod
        ? 'Organization is in grace period (read-only). Renew subscription to restore write access.'
        : state.isExpired
          ? 'Organization subscription is expired. Portal access is disabled until renewed.'
          : 'Organization is in read-only mode.'
    await notifyTelegram('Blocked write/action on non-writable organization', {
      orgId: organizationId,
      name: org?.name,
      slug: org?.slug,
      status: state.status,
      subscriptionEndsAt: state.subscriptionEndsAt?.toISOString() ?? org?.subscriptionEndsAt?.toISOString() ?? null,
      context: context || 'unknown',
      reason,
      event: 'write_blocked',
    })
    throw new Error(reason)
  }
  return state
}