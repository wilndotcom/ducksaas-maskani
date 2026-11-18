import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { resolveTenantContext } from '@/lib/portal'
import { User, Mail, Building2, KeyRound } from 'lucide-react'
import { PortalProfileForms, PortalPasswordForm } from './profile-forms'

export const instant = false

export default async function PortalProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  const { org } = await resolveTenantContext()

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true, username: true, createdAt: true },
  })
  if (!user) redirect('/auth/signin')

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200"><User className="h-3.5 w-3.5" /> Account</p>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Profile & Security</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><User className="h-5 w-5 text-cyan-500" /> Account details</h3>
          <dl className="mb-5 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Mail className="h-3.5 w-3.5" /> Email</dt><dd className="font-medium">{user.email}</dd></div>
            <div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Building2 className="h-3.5 w-3.5" /> Username</dt><dd className="font-medium">{user.username || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Member since</dt><dd className="font-medium">{user.createdAt.toLocaleDateString()}</dd></div>
          </dl>
          <PortalProfileForms userName={user.name} userPhone={user.phone || ''} />
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5 text-amber-500" /> Change password</h3>
          <PortalPasswordForm />
        </section>
      </div>
    </div>
  )
}
