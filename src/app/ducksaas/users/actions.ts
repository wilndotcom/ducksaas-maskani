'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.globalRole !== 'super_admin') redirect('/')
  return session
}

export async function createPlatformUser(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const role = String(formData.get('role') || 'standard')
  if (!name || !email) throw new Error('Name and email are required')
  if (password.length < 8) throw new Error('Password must be at least 8 characters')
  if (!['super_admin', 'standard'].includes(role)) throw new Error('Invalid role')
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) throw new Error('A user with this email already exists')
  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), globalRole: role as 'super_admin' | 'standard' },
  })
  revalidatePath('/ducksaas/users')
}

export async function setUserRole(formData: FormData) {
  const session = await requireAdmin()
  const userId = String(formData.get('userId') || '')
  const role = String(formData.get('role') || '')
  if (!userId || !['super_admin', 'standard'].includes(role)) throw new Error('Invalid request')
  if (userId === session.user.id && role !== 'super_admin') throw new Error('You cannot remove your own admin role')
  await prisma.user.update({ where: { id: userId }, data: { globalRole: role as 'super_admin' | 'standard' } })
  revalidatePath('/ducksaas/users')
}
