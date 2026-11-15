import { prisma } from './prisma'

/**
 * Multi-tenant isolation middleware
 * Ensures all queries are scoped to the current organization
 */

export class MultiTenantScope {
  static withOrganization<T extends { organizationId?: string }>(
    organizationId: string,
    data: T
  ): T {
    return { ...data, organizationId }
  }

  static async getOrganizationForUser(userId: string, role: 'landlord_admin' | 'caretaker' | 'tenant') {
    const member = await prisma.organizationMember.findFirst({
      where: {
        userId,
        role
      },
      include: {
        organization: true
      }
    })

    return member?.organization
  }

  static async getUserOrganizations(userId: string) {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true
      }
    })

    return memberships.map(m => m.organization)
  }

  static async checkSubscriptionStatus(organizationId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptionPlan: true
      }
    })

    if (!organization) {
      throw new Error('Organization not found')
    }

    const isSuspended = organization.status === 'suspended_readonly'
    const isExpired = organization.subscriptionEndsAt && organization.subscriptionEndsAt < new Date()

    return {
      organization,
      isSuspended,
      isExpired,
      canWrite: !isSuspended && !isExpired
    }
  }

  static hasFeature(featureFlags: Record<string, unknown>, feature: string): boolean {
    return featureFlags[feature] === true
  }

  static async checkFeatureAccess(organizationId: string, feature: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptionPlan: true
      }
    })

    if (!organization || !organization.subscriptionPlan) {
      return false
    }

    const featureFlags = organization.subscriptionPlan.featureFlags as Record<string, unknown>
    return this.hasFeature(featureFlags, feature)
  }

  static async checkUnitLimit(organizationId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptionPlan: true
      }
    })

    if (!organization || !organization.subscriptionPlan) {
      return { canAdd: false, current: 0, max: 0 }
    }

    const currentUnits = await prisma.unit.count({
      where: { organizationId }
    })

    const maxUnits = organization.subscriptionPlan.maxUnits

    return {
      canAdd: currentUnits < maxUnits,
      current: currentUnits,
      max: maxUnits
    }
  }
}
