import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Sparkles, Home, FileText, Wrench, MessageSquareWarning, Receipt } from 'lucide-react'

export const instant = false

const nav = [
  { href: '/portal', label: 'Dashboard', icon: Home },
  { href: '/portal/invoices', label: 'My Invoices', icon: FileText },
  { href: '/portal/statement', label: 'Statement', icon: Receipt },
  { href: '/portal/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/portal/complaints', label: 'Complaints', icon: MessageSquareWarning },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, role: 'tenant' },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight">{membership?.organization.name || 'Tenant Portal'}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tenant Portal</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1.5">
            {nav.map((n) => {
              const Icon = n.icon
              return (
                <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
            <a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a>
          </div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}


