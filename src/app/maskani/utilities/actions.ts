'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.utilities')

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Records a water meter reading for a unit for a billing period (YYYY-MM).
 * Consumption = meterReading - previous reading; amount = consumed * unit's water rate.
 * The charge is rolled into the unit's monthly invoice by the billing cron
 * (or stays unbilled until then). Readings already attached to an invoice
 * cannot be edited or deleted.
 */
export async function recordWaterReading(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_invoices', orgId)
  const unitId = String(formData.get('unitId') || '')
  const periodMonth = String(formData.get('periodMonth') || '').trim()
  const meterReading = Number(formData.get('meterReading') || NaN)

  if (!unitId || !periodMonth || !Number.isFinite(meterReading) || meterReading < 0) {
    throw new Error('Unit, period month (YYYY-MM), and a valid meter reading are required')
  }
  if (!MONTH_RE.test(periodMonth)) throw new Error('Period month must be in YYYY-MM format')

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organizationId: orgId },
    select: { id: true, unitNumber: true, waterRatePerUnit: true, property: { select: { name: true } } },
  })
  if (!unit) throw new Error('Unit not found')

  const existing = await prisma.waterReading.findUnique({
    where: { unitId_periodMonth: { unitId, periodMonth } },
    select: { id: true, invoiceId: true },
  })
  if (existing?.invoiceId) throw new Error('This reading is already billed on an invoice and cannot be changed')

  // Previous reading = most recent earlier period for this unit
  const previous = await prisma.waterReading.findFirst({
    where: { unitId, periodMonth: { lt: periodMonth } },
    orderBy: { periodMonth: 'desc' },
    select: { meterReading: true },
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
    where: { unitId_periodMonth: { unitId, periodMonth } },
    update: { meterReading, previousReading, unitsConsumed, ratePerUnit, amount },
    create: {
      organizationId: orgId,
      unitId,
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
