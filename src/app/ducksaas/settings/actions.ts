'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.globalRole !== 'super_admin') throw new Error('Unauthorized')
  return session
}

export async function getPlatformSettings(): Promise<Record<string, unknown> | null> {
  await requireSuperAdmin()
  const row = await prisma.platformSetting.findUnique({ where: { id: 'app' } })
  return (row?.settings as Record<string, unknown>) || null
}

export async function savePlatformSettings(settings: Record<string, unknown>) {
  await requireSuperAdmin()
  await prisma.platformSetting.upsert({
    where: { id: 'app' },
    update: { settings: settings as object },
    create: { id: 'app', settings: settings as object },
  })
}
