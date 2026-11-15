import { Prisma } from '@prisma/client'

export const MASTER_MASKANI_SLUG = process.env.MASKANI_MASTER_ORG_SLUG?.trim() || 'maskani-master'

/**
 * Provision a new organization with a copy of the master Maskani billing template.
 * - Copies landlord payment gateway configurations (org-scoped copies) from the master org if present.
 * - Each new org gets its own isolated records; no shared references.
 * - Safe no-op if no master org is configured/found.
 */
export async function provisionOrgFromMaster(
  tx: Prisma.TransactionClient,
  newOrgId: string,
) {
  const master = await tx.organization.findUnique({
    where: { slug: MASTER_MASKANI_SLUG },
    select: { id: true },
  })
  if (!master) return { copiedGateways: 0 }

  const gateways = await tx.landlordPaymentGateway.findMany({
    where: { organizationId: master.id },
  })

  if (gateways.length > 0) {
    await tx.landlordPaymentGateway.createMany({
      data: gateways.map((g) => ({
        organizationId: newOrgId,
        provider: g.provider,
        accountNumber: g.accountNumber,
        apiCredentialsEncrypted: g.apiCredentialsEncrypted as Prisma.InputJsonValue,
        isActive: g.isActive,
      })),
    })
  }

  return { copiedGateways: gateways.length }
}
