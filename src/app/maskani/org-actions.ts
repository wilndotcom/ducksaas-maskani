'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ORG_COOKIE = 'maskani_org'

export async function setActiveOrganization(orgId: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    select: { id: true },
  })
  if (!membership) throw new Error('You are not a member of that organization')

  const cookieStore = await cookies()
  cookieStore.set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/maskani')
}
