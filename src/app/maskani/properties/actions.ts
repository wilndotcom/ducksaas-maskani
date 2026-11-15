'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireMaskaniPermission, resolveActionOrgId } from '@/lib/maskani'

const resolveOrgId = (orgParam?: string | null) => resolveActionOrgId(orgParam, 'maskani.properties')

export async function createProperty(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_properties', orgId)
  const name = String(formData.get('name') || '').trim()
  const location = String(formData.get('location') || '').trim()
  const type = String(formData.get('type') || '').trim() as 'Apartment' | 'Court' | 'Commercial'
  const totalUnits = Number(formData.get('totalUnits') || 0)

  if (!name || !location || !type) throw new Error('Name, location, and type are required')
  if (!['Apartment', 'Court', 'Commercial'].includes(type)) throw new Error('Invalid property type')
  if (!Number.isInteger(totalUnits) || totalUnits < 0) throw new Error('Total units must be 0 or more')

  await prisma.property.create({
    data: { organizationId: orgId, name, location, type, totalUnits },
  })
  revalidatePath('/maskani')
  revalidatePath('/maskani/properties')
}

export async function updateProperty(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_properties', orgId)
  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const location = String(formData.get('location') || '').trim()
  const type = String(formData.get('type') || '').trim() as 'Apartment' | 'Court' | 'Commercial'
  const totalUnits = Number(formData.get('totalUnits') || 0)

  if (!id || !name || !location || !type) throw new Error('Missing required fields')
  if (!['Apartment', 'Court', 'Commercial'].includes(type)) throw new Error('Invalid property type')
  if (!Number.isInteger(totalUnits) || totalUnits < 0) throw new Error('Total units must be 0 or more')

  const res = await prisma.property.updateMany({
    where: { id, organizationId: orgId },
    data: { name, location, type, totalUnits },
  })
  if (res.count === 0) throw new Error('Property not found')
  revalidatePath('/maskani')
  revalidatePath('/maskani/properties')
}

export async function deleteProperty(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_properties', orgId)
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')
  const res = await prisma.property.deleteMany({ where: { id, organizationId: orgId } })
  if (res.count === 0) throw new Error('Property not found')
  revalidatePath('/maskani')
  revalidatePath('/maskani/properties')
}

export async function createUnit(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_properties', orgId)
  const propertyId = String(formData.get('propertyId') || '')
  const unitNumber = String(formData.get('unitNumber') || '').trim()
  const floorRaw = String(formData.get('floor') || '').trim()
  const monthlyRent = Number(formData.get('monthlyRent') || 0)
  const depositAmount = Number(formData.get('depositAmount') || 0)
  const status = String(formData.get('status') || 'vacant') as 'vacant' | 'occupied' | 'maintenance'

  if (!propertyId || !unitNumber) throw new Error('Property and unit number are required')
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) throw new Error('Monthly rent must be 0 or more')
  if (!Number.isFinite(depositAmount) || depositAmount < 0) throw new Error('Deposit amount must be 0 or more')
  if (!['vacant', 'occupied', 'maintenance'].includes(status)) throw new Error('Invalid status')

  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: orgId }, select: { id: true } })
  if (!property) throw new Error('Property not found')

  const floor = floorRaw === '' ? null : Number(floorRaw)
  if (floor !== null && (!Number.isInteger(floor))) throw new Error('Floor must be a whole number')

  await prisma.unit.create({
    data: { organizationId: orgId, propertyId, unitNumber, floor, monthlyRent, depositAmount, status },
  })
  revalidatePath('/maskani')
  revalidatePath('/maskani/properties')
}

export async function updateUnit(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_properties', orgId)
  const id = String(formData.get('id') || '')
  const propertyId = String(formData.get('propertyId') || '')
  const unitNumber = String(formData.get('unitNumber') || '').trim()
  const floorRaw = String(formData.get('floor') || '').trim()
  const monthlyRent = Number(formData.get('monthlyRent') || 0)
  const depositAmount = Number(formData.get('depositAmount') || 0)
  const status = String(formData.get('status') || 'vacant') as 'vacant' | 'occupied' | 'maintenance'

  if (!id || !propertyId || !unitNumber) throw new Error('Missing required fields')
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) throw new Error('Monthly rent must be 0 or more')
  if (!Number.isFinite(depositAmount) || depositAmount < 0) throw new Error('Deposit amount must be 0 or more')
  if (!['vacant', 'occupied', 'maintenance'].includes(status)) throw new Error('Invalid status')

  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: orgId }, select: { id: true } })
  if (!property) throw new Error('Property not found')

  const floor = floorRaw === '' ? null : Number(floorRaw)
  if (floor !== null && (!Number.isInteger(floor))) throw new Error('Floor must be a whole number')

  const res = await prisma.unit.updateMany({
    where: { id, organizationId: orgId },
    data: { propertyId, unitNumber, floor, monthlyRent, depositAmount, status },
  })
  if (res.count === 0) throw new Error('Unit not found')
  revalidatePath('/maskani')
  revalidatePath('/maskani/properties')
}

export async function deleteUnit(formData: FormData) {
  const orgId = await resolveOrgId(String(formData.get('orgId') || ''))
  await requireMaskaniPermission('manage_properties', orgId)
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')
  const res = await prisma.unit.deleteMany({ where: { id, organizationId: orgId } })
  if (res.count === 0) throw new Error('Unit not found')
  revalidatePath('/maskani')
  revalidatePath('/maskani/properties')
}
