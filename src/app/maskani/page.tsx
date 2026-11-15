import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { startOfDay, startOfMonth, startOfWeek, startOfYear, addDays, format } from 'date-fns'
import { headers } from 'next/headers'
import { getTenantHost } from '@/lib/tenant-domain'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import { pickActiveMembership } from '@/lib/maskani'
import { OrgSwitcher } from './org-switcher'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'
import Link from 'next/link'
import {
  Building2,
  Users,
  Home,
  FileText,
  Wrench,
  CreditCard,
  Plus,
  ArrowRight,
  Sparkles,
  Wallet,
  CalendarDays,
  CalendarRange,
  Calendar,
  AlertCircle,
  Clock,
  TrendingUp,
  DoorOpen,
  UserX,
} from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'

export const instant = false

export default async function MaskaniPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await getServerSession(authOptions)
  const { org: orgParam } = await searchParams

  if (!session) {
    redirect('/auth/signin')
  }

  let org
  let roleLabel = ''
  let userOrgs: { id: string; name: string }[] = []

  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) {
      redirect('/ducksaas')
    }
    org = await prisma.organization.findUnique({
      where: { id: orgParam },
      include: {
        subscriptionPlan: { select: { name: true } },
        _count: { select: { properties: true, units: true, members: true, leases: true, invoices: true, maintenanceTickets: true, rentPayments: true } },
      },
    })
    if (!org) {
      redirect('/ducksaas/organizations')
    }
    const sub = await syncOrganizationSubscription(org.id)
    org = await prisma.organization.findUnique({
      where: { id: orgParam },
      include: {
        subscriptionPlan: { select: { name: true } },
        _count: { select: { properties: true, units: true, members: true, leases: true, invoices: true, maintenanceTickets: true, rentPayments: true } },
      },
    })
    if (!org) redirect('/ducksaas/organizations')
    // Allow super_admin to inspect suspended/expired orgs for support/reactivation.
    const stateLabel = sub.isSuspended ? 'suspended' : sub.isGracePeriod ? 'grace period' : sub.isExpired ? 'expired' : 'active'
    roleLabel = `super_admin (viewing, ${stateLabel})`
  } else {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { id: true, role: true, organizationId: true, organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    userOrgs = memberships.map((m) => m.organization)
    const activeMembership = await pickActiveMembership(session.user.id, memberships)
    const membership = activeMembership
      ? await prisma.organizationMember.findUnique({
          where: { id: activeMembership.id },
          include: {
            organization: {
              include: {
                subscriptionPlan: { select: { name: true } },
                _count: { select: { properties: true, units: true, members: true, leases: true, invoices: true, maintenanceTickets: true, rentPayments: true } },
              },
            },
          },
        })
      : null

    if (!membership) {
      return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-600/30 blur-3xl" />
            <div className="absolute top-1/4 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/25 blur-3xl" />
          </div>
          <div className="relative flex min-h-screen items-center justify-center p-6">
            <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <h1 className="mb-2 text-2xl font-bold">No organization yet</h1>
              <p className="mb-6 text-slate-300">Your account is not linked to an organization. Create one to get your own clean Maskani workspace.</p>
              <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 font-medium text-white shadow-lg">
                <Plus className="h-4 w-4" /> Create organization
              </Link>
            </div>
          </div>
        </div>
      )
    }

    if (membership.role === 'tenant') {
      redirect('/portal')
    }

    org = membership.organization
    const sub = await syncOrganizationSubscription(org.id)
    if (sub.isSuspended) redirect('/maskani/suspended')
    roleLabel = membership.role.replace('_', ' ') + (sub.isGracePeriod ? ' (grace period, read-only)' : '')
  }

  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
  const tenantHost = getTenantHost(org.slug, host)

  const now = new Date()
  const dayStart = startOfDay(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const yearStart = startOfYear(now)
  const vacatingBy = addDays(now, 30)

  const [
    vacantUnits,
    occupiedUnits,
    openTickets,
    incomeToday,
    incomeWeek,
    incomeMonth,
    incomeYear,
    unpaidInvoices,
    vacatingLeases,
  ] = await Promise.all([
    prisma.unit.count({ where: { organizationId: org.id, status: 'vacant' } }),
    prisma.unit.count({ where: { organizationId: org.id, status: 'occupied' } }),
    prisma.maintenanceTicket.count({ where: { organizationId: org.id, status: { in: ['open', 'in_progress'] } } }),
    prisma.rentPayment.aggregate({ _sum: { amount: true }, where: { organizationId: org.id, paidAt: { gte: dayStart } } }),
    prisma.rentPayment.aggregate({ _sum: { amount: true }, where: { organizationId: org.id, paidAt: { gte: weekStart } } }),
    prisma.rentPayment.aggregate({ _sum: { amount: true }, where: { organizationId: org.id, paidAt: { gte: monthStart } } }),
    prisma.rentPayment.aggregate({ _sum: { amount: true }, where: { organizationId: org.id, paidAt: { gte: yearStart } } }),
    prisma.invoice.findMany({
      where: { organizationId: org.id, status: { in: ['unpaid', 'partial', 'overdue'] } },
      include: {
        tenant: { select: { name: true, email: true, phone: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: [{ dueDate: 'asc' }],
      take: 10,
    }),
    prisma.lease.findMany({
      where: { organizationId: org.id, status: 'active', endDate: { gte: now, lte: vacatingBy } },
      include: {
        tenant: { select: { name: true, email: true, phone: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
      orderBy: { endDate: 'asc' },
      take: 10,
    }),
  ])

  const c = org._count
  const isEmpty = c.properties === 0 && c.units === 0 && c.leases === 0
  const occupancy = c.units > 0 ? Math.round((occupiedUnits / c.units) * 100) : 0

  const income = {
    today: incomeToday._sum.amount ?? 0,
    week: incomeWeek._sum.amount ?? 0,
    month: incomeMonth._sum.amount ?? 0,
    year: incomeYear._sum.amount ?? 0,
  }

  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.amountDue - inv.amountPaid), 0)
  const owingTenants = new Set(unpaidInvoices.map((inv) => inv.tenantUserId)).size

  const incomeCards = [
    { label: 'Income Today', value: income.today, hint: 'Since midnight', icon: Wallet, gradient: 'from-cyan-400 via-sky-500 to-blue-600', glow: 'shadow-sky-500/30' },
    { label: 'Income This Week', value: income.week, hint: 'Week to date', icon: CalendarDays, gradient: 'from-fuchsia-500 via-pink-500 to-rose-500', glow: 'shadow-pink-500/30' },
    { label: 'Income This Month', value: income.month, hint: 'Month to date', icon: CalendarRange, gradient: 'from-violet-500 via-purple-500 to-indigo-600', glow: 'shadow-violet-500/30' },
    { label: 'Income This Year', value: income.year, hint: 'Year to date', icon: Calendar, gradient: 'from-amber-400 via-orange-500 to-rose-500', glow: 'shadow-orange-500/30' },
  ]

  const orgQuery = orgParam && session.user.globalRole === 'super_admin' ? `?org=${org.id}` : ''
  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard', active: true },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  const statStyles = [
    { label: 'Properties', value: c.properties, sub: 'Total properties', icon: Building2, color: 'text-cyan-600 dark:text-cyan-300', bg: 'bg-cyan-500/15', ring: 'hover:ring-cyan-400/40', href: `/maskani/properties${orgQuery}` },
    { label: 'Units', value: c.units, sub: `${occupiedUnits} occupied · ${vacantUnits} vacant`, icon: Home, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/15', ring: 'hover:ring-emerald-400/40', href: `/maskani/properties${orgQuery}` },
    { label: 'Occupancy', value: `${occupancy}%`, sub: c.units ? `${occupiedUnits}/${c.units} units` : 'No units yet', icon: Users, color: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-500/15', ring: 'hover:ring-violet-400/40', href: `/maskani/properties${orgQuery}` },
    { label: 'Open Issues', value: openTickets + unpaidInvoices.length, sub: `${openTickets} tickets · ${unpaidInvoices.length} unpaid invoices`, icon: Wrench, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500/15', ring: 'hover:ring-amber-400/40', href: `/maskani/invoices${orgQuery}` },
    { label: 'Vacant Units', value: vacantUnits, sub: c.units ? `${vacantUnits} of ${c.units} units available` : 'No units yet', icon: DoorOpen, color: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-500/15', ring: 'hover:ring-sky-400/40', href: `/maskani/properties${orgQuery}` },
    { label: 'Tenants Owing', value: owingTenants, sub: owingTenants ? `${unpaidInvoices.length} invoices · ${formatCurrency(totalOutstanding, currency)} outstanding` : 'All balances clear', icon: UserX, color: owingTenants ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300', bg: owingTenants ? 'bg-rose-500/15' : 'bg-emerald-500/15', ring: owingTenants ? 'hover:ring-rose-400/40' : 'hover:ring-emerald-400/40', href: `/maskani/invoices${orgQuery}` },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-600/20" />
        <div className="absolute bottom-20 right-1/4 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-500/15" />
      </div>

      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight" title={org.name}>{org.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1.5">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
            <a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={org.name} />
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5" /> Maskani Master Workspace
                </p>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">{org.name}</h2>
                  <a href="/maskani" target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-emerald-300" title="Open organization workspace">{tenantHost}</a>
                  <OrgSwitcher orgs={userOrgs} currentOrgId={org.id} />
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${org.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : org.status === 'grace_period' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
                    {org.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Welcome, <span className="font-medium text-slate-900 dark:text-white">{session.user.name}</span> · {org.subscriptionPlan ? `${org.subscriptionPlan.name} plan` : 'No subscription plan assigned yet'} · Role: {roleLabel}
                </p>
              </div>
              <a href="/auth/signout" className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-rose-600 md:hidden dark:border-white/10 dark:bg-white/5 dark:text-rose-300">Sign out</a>
            </div>

            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Income Overview</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Collected rent payments for this organization</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> Live totals</span>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {incomeCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <Link key={card.label} href={`/maskani/invoices${orgQuery}`} className={`group relative block overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-[1px] shadow-xl ${card.glow} transition hover:-translate-y-0.5`}>
                      <div className="relative h-full rounded-2xl bg-white/10 p-5 backdrop-blur-sm dark:bg-slate-950/20">
                        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/30 blur-2xl transition group-hover:bg-white/40" />
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/25 backdrop-blur">
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{card.hint}</span>
                        </div>
                        <p className="text-sm font-medium text-white/90">{card.label}</p>
                        <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">{formatCurrency(card.value, currency)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {statStyles.map((s) => {
                const Icon = s.icon
                return (
                  <Link key={s.label} href={s.href} className={`block rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm ring-1 ring-transparent backdrop-blur-xl transition ${s.ring} hover:shadow-md dark:border-white/10 dark:bg-white/5`}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} ${s.color}`}><Icon className="h-5 w-5" /></span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.sub}</p>
                  </Link>
                )
              })}
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-500/10 via-white/70 to-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-rose-500/20 dark:from-rose-500/10 dark:via-slate-900/60 dark:to-slate-900/60">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15"><AlertCircle className="h-5 w-5 text-rose-500" /></span> Unpaid &amp; Outstanding Balances</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Tenants with unpaid, partial, or overdue invoices</p>
                  </div>
                  <span className="rounded-xl bg-rose-500/15 px-3 py-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">{formatCurrency(totalOutstanding, currency)}</span>
                </div>
                {unpaidInvoices.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-300">No unpaid invoices. All balances are clear.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr className="border-b border-slate-200/70 dark:border-white/10">
                          <th className="px-3 py-2">Tenant / Unit</th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Due</th>
                          <th className="px-3 py-2">Balance</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                        {unpaidInvoices.map((inv) => {
                          const balance = inv.amountDue - inv.amountPaid
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                              <td className="px-3 py-3">
                                <Link href={`/maskani/tenants/${inv.tenantUserId}${orgQuery}`} className="font-medium text-slate-900 hover:text-emerald-600 hover:underline dark:text-white dark:hover:text-emerald-300">{inv.tenant.name}</Link>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{inv.unit.property.name} · Unit {inv.unit.unitNumber}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{inv.invoiceNumber}<div className="text-xs text-slate-500">{inv.billingMonth}</div></td>
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{format(inv.dueDate, 'dd MMM yyyy')}</td>
                              <td className="px-3 py-3 font-semibold text-rose-600 dark:text-rose-300">{formatCurrency(balance, currency)}</td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${inv.status === 'overdue' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : inv.status === 'partial' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-orange-500/15 text-orange-700 dark:text-orange-300'}`}>{inv.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-white/70 to-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-amber-500/20 dark:from-amber-500/10 dark:via-slate-900/60 dark:to-slate-900/60">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15"><Clock className="h-5 w-5 text-amber-500" /></span> About to Vacate</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Active leases ending in the next 30 days</p>
                  </div>
                  <span className="rounded-xl bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">{vacatingLeases.length} lease{vacatingLeases.length === 1 ? '' : 's'}</span>
                </div>
                {vacatingLeases.length === 0 ? (
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">No active leases ending in the next 30 days.</div>
                ) : (
                  <div className="space-y-3">
                    {vacatingLeases.map((lease) => {
                      const daysLeft = Math.max(0, Math.ceil((lease.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                      return (
                        <div key={lease.id} className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-500/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                          <div>
                            <Link href={`/maskani/tenants/${lease.tenantUserId}${orgQuery}`} className="font-medium text-slate-900 hover:text-emerald-600 hover:underline dark:text-white dark:hover:text-emerald-300">{lease.tenant.name}</Link>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ends {format(lease.endDate, 'dd MMM yyyy')}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${daysLeft <= 7 ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                              {daysLeft} day{daysLeft === 1 ? '' : 's'} left
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            {isEmpty && (
              <div className="mb-8 rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-fuchsia-500/10 p-6 shadow-sm backdrop-blur-xl lg:p-8 dark:border-white/10">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Your clean Maskani workspace is ready</h3>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">This is a fresh, isolated account for <strong>{org.name}</strong> (provisioned from the master Maskani template). Start by adding your first property and units.</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Link href={`/maskani/properties${orgQuery}`} className="group rounded-xl border border-white/60 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
                        <Building2 className="mb-2 h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                        <p className="font-semibold">1. Add property</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Create property &amp; units</p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Get started <ArrowRight className="h-3 w-3" /></span>
                      </Link>
                      <Link href={`/maskani/tenants${orgQuery}`} className="group rounded-xl border border-white/60 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
                        <Users className="mb-2 h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                        <p className="font-semibold">2. Add tenants</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Leases and contacts</p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">Set up <ArrowRight className="h-3 w-3" /></span>
                      </Link>
                      <Link href={`/maskani/invoices${orgQuery}`} className="group rounded-xl border border-white/60 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
                        <CreditCard className="mb-2 h-5 w-5 text-violet-600 dark:text-violet-300" />
                        <p className="font-semibold">3. Track rent</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Invoices &amp; payments</p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300">Configure <ArrowRight className="h-3 w-3" /></span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Link href={`/maskani/properties${orgQuery}`} className="group rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5">
                <p className="text-lg font-semibold">+ Add Property</p>
                <p className="mt-1 text-sm text-emerald-50/90">Register a new property &amp; units</p>
              </Link>
              <Link href={`/maskani/invoices${orgQuery}`} className="group rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-6 text-white shadow-xl shadow-cyan-500/20 transition hover:-translate-y-0.5">
                <p className="text-lg font-semibold">+ Record Payment</p>
                <p className="mt-1 text-sm text-cyan-50/90">Log or generate invoices</p>
              </Link>
              <Link href={`/maskani/tenants${orgQuery}`} className="group rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 p-6 text-white shadow-xl shadow-fuchsia-500/20 transition hover:-translate-y-0.5">
                <p className="text-lg font-semibold">+ Add Tenant</p>
                <p className="mt-1 text-sm text-fuchsia-50/90">Onboard tenant &amp; lease</p>
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Organization summary</h3>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Link href={`/maskani/tenants${orgQuery}`} className="flex items-center gap-3 rounded-xl border border-cyan-200/70 bg-cyan-500/10 p-4 transition hover:bg-cyan-500/20 dark:border-cyan-500/20 dark:bg-cyan-500/10"><FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /><div><p className="text-slate-500 dark:text-slate-400">Leases</p><p className="text-lg font-semibold text-slate-900 dark:text-white">{c.leases}</p></div></Link>
                <Link href={`/maskani/invoices${orgQuery}`} className="flex items-center gap-3 rounded-xl border border-violet-200/70 bg-violet-500/10 p-4 transition hover:bg-violet-500/20 dark:border-violet-500/20 dark:bg-violet-500/10"><CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-300" /><div><p className="text-slate-500 dark:text-slate-400">Invoices</p><p className="text-lg font-semibold text-slate-900 dark:text-white">{c.invoices}</p></div></Link>
                <Link href={`/maskani/maintenance${orgQuery}`} className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-500/10 p-4 transition hover:bg-amber-500/20 dark:border-amber-500/20 dark:bg-amber-500/10"><Wrench className="h-5 w-5 text-amber-600 dark:text-amber-300" /><div><p className="text-slate-500 dark:text-slate-400">Maintenance tickets</p><p className="text-lg font-semibold text-slate-900 dark:text-white">{c.maintenanceTickets}</p></div></Link>
                <Link href={`/maskani/settings${orgQuery}`} className="flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-500/10 p-4 transition hover:bg-emerald-500/20 dark:border-emerald-500/20 dark:bg-emerald-500/10"><Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /><div><p className="text-slate-500 dark:text-slate-400">Members</p><p className="text-lg font-semibold text-slate-900 dark:text-white">{c.members}</p></div></Link>
              </div>
            </div>
          </div>
        </main>
      </div>
      <footer className="relative border-t border-slate-200/80 bg-white/60 px-4 py-4 text-center text-sm text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400">
        Design &amp; Develop by <span className="font-medium text-slate-800 dark:text-slate-200">Wilncom Tech</span>
      </footer>
    </div>
  )
}



