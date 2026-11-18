import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Bell, ArrowLeft, CheckCheck } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { markAllNotificationsRead } from './actions'

export const instant = false

const typeStyles: Record<string, string> = {
  invoice: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  payment: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  ticket: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  complaint: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  lease: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  system: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await getServerSession(authOptions)
  const { org: orgParam } = await searchParams
  if (!session) redirect('/auth/signin')

  let orgId: string
  let orgName = ''
  let orgQuery = ''
  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) redirect('/ducksaas')
    const org = await prisma.organization.findUnique({ where: { id: orgParam }, select: { id: true, name: true } })
    if (!org) redirect('/ducksaas/organizations')
    orgId = org.id
    orgName = org.name
    orgQuery = `?org=${org.id}`
  } else {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, organization: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) redirect('/auth/register')
    orgId = membership.organizationId
    orgName = membership.organization.name
    orgQuery = orgParam ? `?org=${orgParam}` : ''
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const unread = notifications.filter((n) => !n.read).length

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/notifications${orgQuery}`, label: 'Notifications', active: true },
    { href: `/maskani/reports${orgQuery}`, label: 'Reports' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/20" />
      </div>
      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/maskani${orgQuery}`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6 text-cyan-500" /> Notifications {unread > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{unread} new</span>}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{orgName}</p>
          </div>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <input type="hidden" name="orgId" value={orgId} />
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
            </form>
          )}
        </div>

        <div className="space-y-2">
          {notifications.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-white/10 dark:bg-slate-900/60">
              <Bell className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400">No notifications yet. Invoices, payments, tickets, and complaints will show up here.</p>
            </div>
          )}
          {notifications.map((n) => {
            const inner = (
              <div className={`rounded-xl border p-4 transition ${n.read ? 'border-slate-200 bg-white/60 dark:border-white/5 dark:bg-slate-900/40' : 'border-cyan-300/60 bg-cyan-50/60 dark:border-cyan-500/20 dark:bg-cyan-500/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${typeStyles[n.type] || typeStyles.system}`}>{n.type}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-cyan-500" />}
                    </div>
                    <p className={`mt-1.5 text-sm font-semibold ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{n.createdAt.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )
            const href = n.link?.startsWith('/maskani') && orgQuery ? `${n.link}${orgQuery}` : n.link
            return href ? <Link key={n.id} href={href}>{inner}</Link> : <div key={n.id}>{inner}</div>
          })}
        </div>
      </div>
      <MobileNav items={nav} title={`${orgName} · Maskani`} />
    </div>
  )
}
