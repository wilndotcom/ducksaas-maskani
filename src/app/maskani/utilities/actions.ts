'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.utilities')

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Records a water meter reading for a unit for a billing period (YYYY-MM).
 * Consumption = meterReading - the unit's most recent earlier reading.
 * Each reading is stamped with the lease (tenant) it belongs to, so the
 * charge is billed to that tenant — a new tenant never inherits the
 * previous tenant's consumption. Pass leaseId to attribute a reading to a
 * specific lease (e.g. a closing reading for a departing tenant); defaults
 * to the unit's active lease.
 */
export async function recordWaterReading(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_invoices', orgId)
  const unitId = String(formData.get('unitId') || '')
  const periodMonth = String(formData.get('periodMonth') || '').trim()
  const meterReading = Number(formData.get('meterReading') || NaN)
  const leaseIdInput = String(formData.get('leaseId') || '').trim() || null

  if (!unitId || !periodMonth || !Number.isFinite(meterReading) || meterReading < 0) {
    throw new Error('Unit, period month (YYYY-MM), and a valid meter reading are required')
  }
  if (!MONTH_RE.test(periodMonth)) throw new Error('Period month must be in YYYY-MM format')

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organizationId: orgId },
    select: { id: true, unitNumber: true, waterRatePerUnit: true, property: { select: { name: true } } },
  })
  if (!unit) throw new Error('Unit not found')

  // Resolve which lease this reading belongs to
  const lease = leaseIdInput
    ? await prisma.lease.findFirst({
        where: { id: leaseIdInput, unitId, organizationId: orgId },
        select: { id: true },
      })
    : await prisma.lease.findFirst({
        where: { unitId, organizationId: orgId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
  if (!lease) throw new Error(leaseIdInput ? 'Lease not found for this unit' : 'No active lease on this unit — pick the lease this reading belongs to')

  const existing = await prisma.waterReading.findUnique({
    where: { unitId_periodMonth_leaseId: { unitId, periodMonth, leaseId: lease.id } },
    select: { id: true, invoiceId: true, createdAt: true },
  })
  if (existing?.invoiceId) throw new Error('This reading is already billed on an invoice and cannot be changed')

  // Previous reading = most recent earlier reading for this unit's meter.
  // Same-month readings by other leases (e.g. handover) count as earlier
  // only if they were recorded before this one.
  const candidates = await prisma.waterReading.findMany({
    where: { unitId, periodMonth: { lte: periodMonth } },
    orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, periodMonth: true, meterReading: true, createdAt: true },
  })
  const previous = candidates.find((r) => {
    if (existing && r.id === existing.id) return false
    if (r.periodMonth < periodMonth) return true
    // same month: only readings recorded before this one count
    return existing ? r.createdAt < existing.createdAt : true
  })
  const previousReading = previous?.meterReading ?? null
  if (previousReading !== null && meterReading < previousReading) {
    throw new Error('Meter reading is lower than the previous reading — check for a meter reset')
  }
  // First-ever reading has no baseline; consumption cannot be computed, so bill flat 0
  // unless the landlord provides a starting reading. We treat first reading as baseline.
  const unitsConsumed = previousReading === null ? 0 : meterReading - previousReading
  const ratePerUnit = unit.waterRatePerUnit
  const amount = Math.round(unitsConsumed * ratePerUnit * 100) / 100

  await prisma.waterReading.upsert({
    where: { unitId_periodMonth_leaseId: { unitId, periodMonth, leaseId: lease.id } },
    update: { meterReading, previousReading, unitsConsumed, ratePerUnit, amount },
    create: {
      organizationId: orgId,
      unitId,
      leaseId: lease.id,
      periodMonth,
      meterReading,
      previousReading,
      unitsConsumed,
      ratePerUnit,
      amount,
    },
  })

  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
}

export async function deleteWaterReading(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_invoices', orgId)
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')
  const reading = await prisma.waterReading.findFirst({ where: { id, organizationId: orgId }, select: { invoiceId: true } })
  if (!reading) throw new Error('Reading not found')
  if (reading.invoiceId) throw new Error('This reading is already billed on an invoice and cannot be deleted')
  await prisma.waterReading.delete({ where: { id } })
  revalidatePath('/maskani')
  revalidatePath('/maskani/tenants')
}
