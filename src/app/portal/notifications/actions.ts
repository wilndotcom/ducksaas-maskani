'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function markTenantNotificationsRead() {
  const session = await getServerSession(authOptions)
  if (!session) return
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, role: 'tenant' },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) return
  await prisma.notification.updateMany({
    where: { userId: session.user.id, organizationId: membership.organizationId, read: false },
    data: { read: true },
  })
  revalidatePath('/portal/notifications')
}
