import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Ban } from 'lucide-react'

export const instant = false

export default async function PortalSuspended() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, role: 'tenant' },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:bg-slate-900/60">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg">
          <Ban className="h-7 w-7 text-white" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Portal suspended</h1>
        <p className="mb-2 text-slate-600 dark:text-slate-300">
          {membership?.organization.name || 'Your organization'}&apos;s subscription has expired, so tenant portal access is temporarily disabled.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Please contact your landlord or property manager to renew the subscription.</p>
      </div>
    </div>
  )
}


