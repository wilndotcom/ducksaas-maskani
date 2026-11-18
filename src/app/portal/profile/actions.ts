'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  return session.user
}

export async function updatePortalProfile(formData: FormData) {
  const user = await requireUser()
  const name = String(formData.get('name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  if (!name) throw new Error('Name is required')
  await prisma.user.update({
    where: { id: user.id },
    data: { name, phone: phone || null },
  })
  revalidatePath('/portal/profile')
  revalidatePath('/portal')
}

export async function changePortalPassword(formData: FormData) {
  const user = await requireUser()
  const current = String(formData.get('currentPassword') || '')
  const next = String(formData.get('newPassword') || '')
  const confirm = String(formData.get('confirmPassword') || '')
  if (next.length < 8) throw new Error('New password must be at least 8 characters')
  if (next !== confirm) throw new Error('Passwords do not match')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
  if (!dbUser?.passwordHash) throw new Error('Password change is not available for this account')
  const ok = await bcrypt.compare(current, dbUser.passwordHash)
  if (!ok) throw new Error('Current password is incorrect')

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  })
  revalidatePath('/portal/profile')
}
