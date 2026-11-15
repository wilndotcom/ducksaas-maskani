import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'
import { startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import Link from 'next/link'
import {
  Wallet,
  CalendarDays,
  CalendarRange,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Users,
  Home,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'

export const instant = false

export default async function DuckSaaSPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.globalRole !== 'super_admin') {
    redirect('/')
  }

  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const now = new Date()
  const dayStart = startOfDay(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const yearStart = startOfYear(now)

  const [incomeToday, incomeWeek, incomeMonth, incomeYear, orgCount, activeOrgCount, totalUnits, expiredSubs, recentSubs] =
    await Promise.all([
      prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: dayStart } } }),
      prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: weekStart } } }),
      prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: monthStart } } }),
      prisma.saaSSubscriptionLedger.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: yearStart } } }),
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'active' } }),
      prisma.unit.count(),
      prisma.organization.count({
        where: {
          OR: [{ status: 'suspended_readonly' }, { subscriptionEndsAt: { lt: now } }],
        },
      }),
      prisma.saaSSubscriptionLedger.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { organization: { select: { name: true } }, plan: { select: { name: true } } },
      }),
    ])

  const income = {
    today: incomeToday._sum.amount ?? 0,
    week: incomeWeek._sum.amount ?? 0,
    month: incomeMonth._sum.amount ?? 0,
    year: incomeYear._sum.amount ?? 0,
  }

  const incomeCards = [
    { label: 'Income Today', value: income.today, hint: 'Since midnight', icon: Wallet, gradient: 'from-cyan-400 via-sky-500 to-blue-600', glow: 'shadow-sky-500/30', chip: 'bg-white/20 text-white', href: '/ducksaas/revenue' },
    { label: 'Income This Week', value: income.week, hint: 'Week to date', icon: CalendarDays, gradient: 'from-fuchsia-500 via-pink-500 to-rose-500', glow: 'shadow-pink-500/30', chip: 'bg-white/20 text-white', href: '/ducksaas/revenue' },
    { label: 'Income This Month', value: income.month, hint: 'Month to date', icon: CalendarRange, gradient: 'from-violet-500 via-purple-500 to-indigo-600', glow: 'shadow-violet-500/30', chip: 'bg-white/20 text-white', href: '/ducksaas/revenue' },
    { label: 'Income This Year', value: income.year, hint: 'Year to date', icon: Calendar, gradient: 'from-amber-400 via-orange-500 to-rose-500', glow: 'shadow-orange-500/30', chip: 'bg-white/20 text-white', href: '/ducksaas/revenue' },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-700 dark:border-fuchsia-400/30 dark:text-fuchsia-200">
          <Sparkles className="h-3.5 w-3.5" /> SaaS Control Center
        </p>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Dashboard</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Real-time platform income and growth overview</p>
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Income Overview</h3>
          <Link href="/ducksaas/revenue" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-300">
            <ArrowUpRight className="h-3.5 w-3.5" /> View revenue details
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {incomeCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.label}
                href={card.href}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-[1px] shadow-xl ${card.glow} transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50`}
              >
                <div className="relative h-full rounded-2xl bg-white/10 p-5 backdrop-blur-sm dark:bg-slate-950/20">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/30 blur-2xl transition group-hover:bg-white/40 dark:bg-white/20 dark:group-hover:bg-white/30" />
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/25 backdrop-blur">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${card.chip}`}>{card.hint}</span>
                  </div>
                  <p className="text-sm font-medium text-white/90">{card.label}</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">{formatCurrency(card.value, currency)}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/80">Open <ArrowUpRight className="h-3 w-3" /></p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/ducksaas/organizations" className="group rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/40">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Active Organizations</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"><Users className="h-4 w-4" /></span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeOrgCount}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{orgCount} total organizations</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 group-hover:underline dark:text-emerald-300">Manage organizations <ArrowUpRight className="h-3 w-3" /></p>
        </Link>

        <Link href="/ducksaas/organizations" className="group rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-500/40">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Units Managed</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300"><Home className="h-4 w-4" /></span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalUnits}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Across all landlords</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 group-hover:underline dark:text-cyan-300">View organizations <ArrowUpRight className="h-3 w-3" /></p>
        </Link>

        <Link href="/ducksaas/revenue" className="group rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-violet-500/40">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Year-to-Date Revenue</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"><TrendingUp className="h-4 w-4" /></span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(income.year, currency)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">All recorded ledger income</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-600 group-hover:underline dark:text-violet-300">Open revenue <ArrowUpRight className="h-3 w-3" /></p>
        </Link>

        <Link href="/ducksaas/organizations" className="group rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-rose-400/50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-rose-500/40">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Attention Needed</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"><AlertTriangle className="h-4 w-4" /></span>
          </div>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-300">{expiredSubs}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Expired or suspended orgs</p>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-rose-600 group-hover:underline dark:text-rose-300">Review organizations <ArrowUpRight className="h-3 w-3" /></p>
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Subscription Income</h3>
          <Link href="/ducksaas/revenue" className="text-xs font-medium text-fuchsia-600 hover:underline dark:text-fuchsia-300">View all</Link>
        </div>
        {recentSubs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No subscription income recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {recentSubs.map((sub) => (
              <Link
                key={sub.id}
                href="/ducksaas/revenue"
                className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 px-4 py-3 transition hover:border-fuchsia-300/60 hover:bg-white dark:border-white/5 dark:bg-slate-900/40 dark:hover:border-fuchsia-500/30"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{sub.organization.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sub.plan.name} plan Â· {sub.gateway} Â· {sub.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-300">+{formatCurrency(sub.amount, currency)}</p>
                  <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    {sub.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

