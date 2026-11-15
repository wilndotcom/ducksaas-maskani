import { TrendingUp, Wallet, CalendarDays, CalendarRange, Calendar, Receipt, Building2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'

export const instant = false

export default async function RevenuePage() {
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)
  const now = new Date()
  const dayStart = startOfDay(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const yearStart = startOfYear(now)

  const [today, week, month, year, all, byStatus, byGateway, ledger, topOrgs] = await Promise.all([
    prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, _count: true, where: { createdAt: { gte: dayStart } } }),
    prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, _count: true, where: { createdAt: { gte: weekStart } } }),
    prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, _count: true, where: { createdAt: { gte: monthStart } } }),
    prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, _count: true, where: { createdAt: { gte: yearStart } } }),
    prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.saaSSubscriptionLedger.groupBy({ by: ['status'], _sum: { amount: true }, _count: true }),
    prisma.saaSSubscriptionLedger.groupBy({ by: ['gateway'], _sum: { amount: true }, _count: true }),
    prisma.saaSSubscriptionLedger.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true, slug: true } }, plan: { select: { name: true } } },
    }),
    prisma.saaSSubscriptionLedger.groupBy({
      by: ['organizationId'],
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),
  ])

  const orgIds = topOrgs.map((t) => t.organizationId)
  const orgs = orgIds.length ? await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true, slug: true } }) : []
  const orgMap = new Map(orgs.map((o) => [o.id, o]))

  const cards = [
    { label: 'Today', value: today._sum.amount ?? 0, count: today._count, icon: Wallet, hint: 'Since midnight' },
    { label: 'This Week', value: week._sum.amount ?? 0, count: week._count, icon: CalendarDays, hint: 'Week to date' },
    { label: 'This Month', value: month._sum.amount ?? 0, count: month._count, icon: CalendarRange, hint: 'Month to date' },
    { label: 'This Year', value: year._sum.amount ?? 0, count: year._count, icon: Calendar, hint: 'Year to date' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg"><TrendingUp className="h-5 w-5" /></span>
          Revenue
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Subscription ledger income, gateways, and recent transactions.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center justify-between"><p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><Icon className="h-4 w-4" /></span></div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(c.value, currency)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.count} entries · {c.hint}</p>
            </div>
          )
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-slate-500 dark:text-slate-400">All-time Revenue</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(all._sum.amount ?? 0, currency)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{all._count} total ledger entries</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="mb-3 flex items-center gap-2 font-medium"><Receipt className="h-4 w-4" /> By Status</p>
          {byStatus.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
            <div className="space-y-2">{byStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-sm"><span className="capitalize text-slate-700 dark:text-slate-300">{s.status} ({s._count})</span><span className="font-medium">{formatCurrency(s._sum.amount ?? 0, currency)}</span></div>
            ))}</div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="mb-3 flex items-center gap-2 font-medium"><Wallet className="h-4 w-4" /> By Gateway</p>
          {byGateway.length === 0 ? <p className="text-sm text-slate-500">No data</p> : (
            <div className="space-y-2">{byGateway.map((g) => (
              <div key={g.gateway} className="flex items-center justify-between text-sm"><span className="text-slate-700 dark:text-slate-300">{g.gateway || 'unknown'} ({g._count})</span><span className="font-medium">{formatCurrency(g._sum.amount ?? 0, currency)}</span></div>
            ))}</div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5" /> Top Organizations by Revenue</h2>
        {topOrgs.length === 0 ? <p className="text-sm text-slate-500">No revenue recorded yet.</p> : (
          <div className="space-y-3">{topOrgs.map((t) => {
            const o = orgMap.get(t.organizationId)
            return (
              <div key={t.organizationId} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-slate-900/40">
                <div><p className="font-medium">{o?.name || t.organizationId}</p><p className="text-xs text-slate-500">{o?.slug ? `${o.slug} · ` : ''}{t._count} payments</p></div>
                <p className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(t._sum.amount ?? 0, currency)}</p>
              </div>
            )
          })}</div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-lg font-semibold">Recent Ledger Entries</h2>
        {ledger.length === 0 ? <p className="text-sm text-slate-500">No subscription income recorded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-white/10 text-slate-500"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Organization</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Gateway</th><th className="py-2 pr-3">Status</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody>{ledger.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 pr-3 whitespace-nowrap">{e.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="py-2 pr-3">{e.organization.name}</td>
                  <td className="py-2 pr-3">{e.plan.name}</td>
                  <td className="py-2 pr-3">{e.gateway || '—'}</td>
                  <td className="py-2 pr-3 capitalize">{e.status}</td>
                  <td className="py-2 text-right font-medium text-emerald-600 dark:text-emerald-300">{formatCurrency(e.amount, currency)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
