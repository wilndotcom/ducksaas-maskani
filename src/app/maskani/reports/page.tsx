import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { BarChart3, Wallet, AlertTriangle, Home, ArrowLeft, TrendingUp } from 'lucide-react'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import { MobileNav } from '@/components/mobile-nav'
import { getSavedCurrency, formatCurrency } from '@/lib/currency'
import { cookies } from 'next/headers'

export const instant = false

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await getServerSession(authOptions)
  const { org: orgParam } = await searchParams
  if (!session) redirect('/auth/signin')

  let org: { id: string; name: string; status: string; slug: string }
  let roleLabel = ''
  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) redirect('/ducksaas')
    const o = await prisma.organization.findUnique({ where: { id: orgParam }, select: { id: true, name: true, status: true, slug: true } })
    if (!o) redirect('/ducksaas/organizations')
    org = o
    roleLabel = 'super_admin'
  } else {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { id: true, name: true, status: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) redirect('/auth/register')
    org = membership.organization
    roleLabel = membership.role.replace('_', ' ')
  }
  const sub = await syncOrganizationSubscription(org.id)
  if (sub.isSuspended) redirect('/maskani/suspended')

  const orgQuery = orgParam && session.user.globalRole === 'super_admin' ? `?org=${org.id}` : ''
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)
  const fmt = (n: number) => formatCurrency(n, currency)
  const now = new Date()

  const [invoices, leases, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: org.id },
      orderBy: { dueDate: 'desc' },
      take: 500,
      include: {
        tenant: { select: { name: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
    }),
    prisma.lease.findMany({
      where: { organizationId: org.id, status: 'active' },
      include: {
        tenant: { select: { name: true } },
        unit: { select: { unitNumber: true, monthlyRent: true, property: { select: { name: true } } } },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.rentPayment.findMany({
      where: { organizationId: org.id },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'desc' },
      take: 1000,
    }),
  ])

  const totalBilled = invoices.reduce((s, i) => s + i.amountDue, 0)
  const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0)
  const outstanding = totalBilled - totalCollected
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0

  // Arrears aging by days past due
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 }
  for (const i of invoices) {
    const bal = i.amountDue - i.amountPaid
    if (bal <= 0.01 || i.status === 'paid') continue
    const days = Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000)
    if (days <= 0) aging.current += bal
    else if (days <= 30) aging.d30 += bal
    else if (days <= 60) aging.d60 += bal
    else aging.d90 += bal
  }

  // Last 6 months collections
  const months: { label: string; total: number }[] = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), total: payments.filter((p) => p.paidAt.toISOString().slice(0, 7) === key).reduce((s, p) => s + p.amount, 0) })
  }
  const maxMonth = Math.max(...months.map((m) => m.total), 1)

  // Rent roll per property
  const rollByProperty = new Map<string, { units: number; rent: number; tenants: number }>()
  for (const l of leases) {
    const p = l.unit.property.name
    const e = rollByProperty.get(p) || { units: 0, rent: 0, tenants: 0 }
    e.units++
    e.rent += l.unit.monthlyRent
    e.tenants++
    rollByProperty.set(p, e)
  }

  const nav = (oq: string) => [
    { href: `/maskani${oq}`, label: 'Dashboard' },
    { href: `/maskani/properties${oq}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${oq}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${oq}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${oq}`, label: 'Maintenance' },
    { href: `/maskani/complaints${oq}`, label: 'Complaints' },
    { href: `/maskani/notifications${oq}`, label: 'Notifications' },
    { href: `/maskani/reports${oq}`, label: 'Reports', active: true },
    { href: `/maskani/settings${oq}`, label: 'Settings' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><BarChart3 className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={org.name}>{org.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">{nav(orgQuery).map((n) => <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>)}</nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav(orgQuery)} title={org.name} />
          <div className="mx-auto max-w-6xl">
            <Link href={`/maskani${orgQuery}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
            <div className="mb-8">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-200"><BarChart3 className="h-3.5 w-3.5" /> Reports</p>
              <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Reports & Analytics</h2>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name} · Role: {roleLabel}</p>
            </div>

            {/* Collection summary */}
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: 'Total billed', value: fmt(totalBilled), icon: Wallet, cls: 'text-cyan-600 dark:text-cyan-300' },
                { label: 'Collected', value: fmt(totalCollected), icon: TrendingUp, cls: 'text-emerald-600 dark:text-emerald-300' },
                { label: 'Outstanding', value: fmt(outstanding), icon: AlertTriangle, cls: 'text-rose-600 dark:text-rose-300' },
                { label: 'Collection rate', value: `${collectionRate}%`, icon: BarChart3, cls: 'text-violet-600 dark:text-violet-300' },
              ].map((c) => {
                const Icon = c.icon
                return (
                  <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                    <div className="mb-2 flex items-center justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p><Icon className={`h-4 w-4 ${c.cls}`} /></div>
                    <p className="text-xl font-bold">{c.value}</p>
                  </div>
                )
              })}
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              {/* Arrears aging */}
              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-rose-500" /> Arrears aging</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Not yet due', amount: aging.current, cls: 'bg-sky-500' },
                    { label: '1–30 days overdue', amount: aging.d30, cls: 'bg-amber-500' },
                    { label: '31–60 days overdue', amount: aging.d60, cls: 'bg-orange-500' },
                    { label: '60+ days overdue', amount: aging.d90, cls: 'bg-rose-600' },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{b.label}</span>
                      <span className="font-semibold">{fmt(b.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  {(() => {
                    const total = aging.current + aging.d30 + aging.d60 + aging.d90 || 1
                    return (
                      <div className="flex h-full">
                        <div className="bg-sky-500" style={{ width: `${(aging.current / total) * 100}%` }} />
                        <div className="bg-amber-500" style={{ width: `${(aging.d30 / total) * 100}%` }} />
                        <div className="bg-orange-500" style={{ width: `${(aging.d60 / total) * 100}%` }} />
                        <div className="bg-rose-600" style={{ width: `${(aging.d90 / total) * 100}%` }} />
                      </div>
                    )
                  })()}
                </div>
              </section>

              {/* Collections trend */}
              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-emerald-500" /> Collections — last 6 months</h3>
                <div className="flex h-40 items-end gap-3">
                  {months.map((m) => (
                    <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">{m.total > 0 ? fmt(m.total) : ''}</span>
                      <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-cyan-400" style={{ height: `${Math.max(4, (m.total / maxMonth) * 100)}%` }} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{m.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Rent roll */}
            <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Home className="h-5 w-5 text-cyan-500" /> Rent roll by property</h3>
              {rollByProperty.size === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No active leases.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                        <th className="pb-2 pr-4">Property</th>
                        <th className="pb-2 pr-4 text-right">Occupied units</th>
                        <th className="pb-2 pr-4 text-right">Monthly rent roll</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...rollByProperty.entries()].map(([name, r]) => (
                        <tr key={name} className="border-b border-slate-100 dark:border-white/5">
                          <td className="py-2.5 pr-4 font-medium">{name}</td>
                          <td className="py-2.5 pr-4 text-right">{r.units}</td>
                          <td className="py-2.5 pr-4 text-right font-semibold">{fmt(r.rent)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="py-2.5 pr-4">Total</td>
                        <td className="py-2.5 pr-4 text-right">{leases.length}</td>
                        <td className="py-2.5 pr-4 text-right">{fmt([...rollByProperty.values()].reduce((s, r) => s + r.rent, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
