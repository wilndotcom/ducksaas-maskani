'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function markAllNotificationsRead(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session) return
  const orgId = String(formData.get('orgId') || '')
  await prisma.notification.updateMany({
    where: { userId: session.user.id, organizationId: orgId, read: false },
    data: { read: true },
  })
  revalidatePath('/maskani/notifications')
}
