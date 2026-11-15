import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Settings, CreditCard, Building2, Users, Shield } from 'lucide-react'
import { PlanPicker } from './plan-picker'
import { MobileNav } from '@/components/mobile-nav'

export const instant = false

export default async function MaskaniPaymentPlanPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [organization, stats, gateways, plans] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      include: { owner: { select: { name: true, email: true } }, subscriptionPlan: true },
    }),
    prisma.organization.findUnique({
      where: { id: org.id },
      include: { _count: { select: { properties: true, units: true, members: true, leases: true } } },
    }),
    prisma.landlordPaymentGateway.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } }),
  ])
  if (!organization || !stats) throw new Error('Organization not found')

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/notifications${orgQuery}`, label: 'Notifications' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings', active: true },
  ]

  const plan = organization.subscriptionPlan

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={org.name}>{org.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">{nav.map((n) => <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>)}</nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={org.name} />
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Link href={`/maskani${orgQuery}`} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
                <span className="text-slate-400">/</span>
                <Link href={`/maskani/settings${orgQuery}`} className="hover:text-slate-900 dark:hover:text-white">Settings</Link>
              </div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-200"><CreditCard className="h-3.5 w-3.5" /> Payment & Plan</p>
              <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Payment & Plan Settings</h2>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name} Â· Role: {roleLabel}</p>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Building2 className="h-4 w-4" /> Properties</p><p className="mt-1 text-2xl font-bold">{stats._count.properties}</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><HomeIcon /> Units</p><p className="mt-1 text-2xl font-bold">{stats._count.units}</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Users className="h-4 w-4" /> Members</p><p className="mt-1 text-2xl font-bold">{stats._count.members}</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Shield className="h-4 w-4" /> Leases</p><p className="mt-1 text-2xl font-bold">{stats._count.leases}</p></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5 text-fuchsia-500" /> Organization Profile</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-slate-200/70 pb-2 dark:border-white/10"><dt className="text-slate-500 dark:text-slate-400">Organization name</dt><dd className="font-medium text-slate-900 dark:text-white">{organization.name}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-200/70 pb-2 dark:border-white/10"><dt className="text-slate-500 dark:text-slate-400">Slug / subdomain</dt><dd className="font-medium text-slate-900 dark:text-white">{organization.slug}</dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-200/70 pb-2 dark:border-white/10"><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd><span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${organization.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : organization.status === 'grace_period' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>{organization.status.replace('_', ' ')}</span></dd></div>
                  <div className="flex justify-between gap-4 border-b border-slate-200/70 pb-2 dark:border-white/10"><dt className="text-slate-500 dark:text-slate-400">Owner</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{organization.owner.name}<div className="text-xs font-normal text-slate-500 dark:text-slate-400">{organization.owner.email}</div></dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500 dark:text-slate-400">Workspace URL</dt><dd className="font-medium text-cyan-700 dark:text-cyan-300">{organization.slug}</dd></div>
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5 text-violet-500" /> Subscription Plan</h3>
                {plan ? (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-violet-200/60 bg-violet-500/10 p-4 dark:border-violet-500/20">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</p>
                      <p className="text-slate-600 dark:text-slate-300">{formatCurrency(plan.priceMonthly, currency)}/mo · {formatCurrency(plan.priceYearly, currency)}/yr</p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">Max units: {plan.maxUnits}</p>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-200/70 pb-2 dark:border-white/10"><dt className="text-slate-500 dark:text-slate-400">Plan status</dt><dd><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${plan.isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>{plan.isActive ? 'Active' : 'Inactive'}</span></dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500 dark:text-slate-400">Subscription ends</dt><dd className="font-medium text-slate-900 dark:text-white">{organization.subscriptionEndsAt ? organization.subscriptionEndsAt.toISOString().slice(0, 10) : 'Not set'}</dd></div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:text-amber-200">
                    <p className="font-medium">No subscription plan assigned</p>
                    <p className="mt-1 text-amber-700/90 dark:text-amber-200/80">This organization can operate with default limits. A super admin can assign a plan from DuckSaaS Organizations.</p>
                  </div>
                )}
                <PlanPicker orgId={org.id} plans={plans} currentPlanId={organization.subscriptionPlanId} propertyCount={stats._count.properties} />
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Payments are processed securely. You can also ask the DuckSaaS super admin to assign a plan manually.</p>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl lg:col-span-2 dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5 text-emerald-500" /> Landlord Payment Gateway Configuration</h3>
                {gateways.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">
                    <p className="font-medium text-slate-900 dark:text-white">No landlord payment gateways configured yet</p>
                    <p className="mt-1">Configure M-Pesa Paybill/Till, Paystack subaccount, or bank transfer details to enable tenant rent collection for this organization. New organizations can be provisioned from the master template&apos;s gateway setup when available.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {gateways.map((g) => (
                      <div key={g.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-medium capitalize text-slate-900 dark:text-white">{g.provider.replace(/_/g, ' ')}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${g.isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>{g.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Account: {g.accountNumber}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Credentials stored securely (encrypted). Updated {g.updatedAt.toISOString().slice(0, 10)}.</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link href={`/maskani/invoices${orgQuery}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white/60 px-4 py-2 font-medium text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"><CreditCard className="h-4 w-4" /> Go to Rent & Invoices</Link>
                  <Link href={`/maskani/settings${orgQuery}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white/60 px-4 py-2 font-medium text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"><Settings className="h-4 w-4" /> All Settings</Link>
                </div>
              </section>
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

function HomeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>
  )
}
