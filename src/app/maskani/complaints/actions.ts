'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveMaskaniOrg } from '@/lib/maskani'
import { requireMaskaniPermission } from '@/lib/maskani'
import { assertOrganizationWritable } from '@/lib/subscription-enforcement'

export async function createComplaint(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  const orgParam = String(formData.get('orgId') || '') || undefined
  const { org } = await resolveMaskaniOrg(orgParam)
  await assertOrganizationWritable(org.id, 'maskani.complaints.create')
  await requireMaskaniPermission('manage_complaints', org.id)

  const subject = String(formData.get('subject') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const priority = String(formData.get('priority') || 'medium') as 'low' | 'medium' | 'high'
  const unitId = String(formData.get('unitId') || '').trim() || null
  const tenantUserId = String(formData.get('tenantUserId') || '').trim() || null
  if (!subject || !description) throw new Error('Subject and description are required')
  if (!['low', 'medium', 'high'].includes(priority)) throw new Error('Invalid priority')

  await prisma.complaint.create({
    data: {
      organizationId: org.id,
      subject,
      description,
      priority,
      unitId,
      tenantUserId,
      status: 'open',
    },
  })
  revalidatePath('/maskani/complaints')
  revalidatePath('/maskani')
}

export async function updateComplaintStatus(formData: FormData) {
  const orgParam = String(formData.get('orgId') || '') || undefined
  const { org } = await resolveMaskaniOrg(orgParam)
  await assertOrganizationWritable(org.id, 'maskani.complaints.update')
  await requireMaskaniPermission('manage_complaints', org.id)
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || 'open') as 'open' | 'in_progress' | 'resolved' | 'closed'
  const resolutionNote = String(formData.get('resolutionNote') || '').trim() || null
  if (!id) throw new Error('Missing complaint id')
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) throw new Error('Invalid status')

  const existing = await prisma.complaint.findFirst({ where: { id, organizationId: org.id }, select: { id: true } })
  if (!existing) throw new Error('Complaint not found')

  await prisma.complaint.update({
    where: { id },
    data: { status, resolutionNote: ['resolved', 'closed'].includes(status) ? resolutionNote : null },
  })
  revalidatePath('/maskani/complaints')
  revalidatePath('/maskani')
}