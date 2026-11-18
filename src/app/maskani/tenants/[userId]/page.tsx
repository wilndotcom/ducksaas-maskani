import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getSavedCurrency, formatCurrency } from '@/lib/currency'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Home, FileText, Wrench, MessageSquareWarning, Mail, Phone, Droplets, CalendarDays, ShieldCheck } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { updateDepositStatus } from '../actions'

export const instant = false

const nav = (orgQuery: string) => [
  { href: `/maskani${orgQuery}`, label: 'Dashboard' },
  { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
  { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases', active: true },
  { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
  { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
  { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
  { href: `/maskani/notifications${orgQuery}`, label: 'Notifications' },
  { href: `/maskani/reports${orgQuery}`, label: 'Reports' },
  { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
]

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ org?: string }>
}) {
  const { userId } = await params
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [user, membership, leases, invoices, tickets, complaints] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, username: true, createdAt: true },
    }),
    prisma.organizationMember.findFirst({
      where: { organizationId: org.id, userId },
      select: { role: true, unitId: true, createdAt: true },
    }),
    prisma.lease.findMany({
      where: { organizationId: org.id, tenantUserId: userId },
      orderBy: { startDate: 'desc' },
      include: {
        unit: {
          select: {
            id: true, unitNumber: true, floor: true, monthlyRent: true, depositAmount: true,
            waterRatePerUnit: true, status: true,
            property: { select: { name: true, location: true, type: true } },
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { organizationId: org.id, tenantUserId: userId },
      orderBy: { dueDate: 'desc' },
      take: 50,
      select: { id: true, invoiceNumber: true, billingMonth: true, amountDue: true, amountPaid: true, dueDate: true, status: true, waterAmount: true },
    }),
    prisma.maintenanceTicket.findMany({
      where: { organizationId: org.id, tenantUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, status: true, priority: true, createdAt: true },
    }),
    prisma.complaint.findMany({
      where: { organizationId: org.id, tenantUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, subject: true, status: true, priority: true, createdAt: true },
    }),
  ])

  if (!user || !membership) notFound()

  const totalBilled = invoices.reduce((s, i) => s + i.amountDue, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0)
  const outstanding = totalBilled - totalPaid
  const openTickets = tickets.filter((t) => t.status !== 'resolved').length
  const openComplaints = complaints.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length
  const activeLease = leases.find((l) => l.status === 'active')

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><User className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={org.name}>{org.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">
            {nav(orgQuery).map((n) => (
              <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav(orgQuery)} title={org.name} />
          <div className="mx-auto max-w-6xl">
            <Link href={`/maskani/tenants${orgQuery}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to tenants</Link>

            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200"><User className="h-3.5 w-3.5" /> Tenant Details</p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">{user.name}</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name} · {membership.role.replace('_', ' ')} · Role context: {roleLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeLease && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Active lease</span>}
                {outstanding > 0.01 && <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">Owes {formatCurrency(outstanding, currency)}</span>}
              </div>
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><User className="h-5 w-5 text-cyan-500" /> Contact & Account</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Name</dt><dd className="font-medium">{user.name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Email</dt><dd className="flex items-center gap-1.5 font-medium"><Mail className="h-3.5 w-3.5 text-slate-400" />{user.email}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Phone</dt><dd className="flex items-center gap-1.5 font-medium">{user.phone ? <><Phone className="h-3.5 w-3.5 text-slate-400" />{user.phone}</> : '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Username</dt><dd className="font-medium">{user.username || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Member since</dt><dd className="font-medium">{membership.createdAt.toLocaleDateString()}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Account created</dt><dd className="font-medium">{user.createdAt.toLocaleDateString()}</dd></div>
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:col-span-2">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Home className="h-5 w-5 text-emerald-500" /> Property & Leases</h3>
                {leases.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">No leases for this tenant in {org.name}.</p>
                ) : (
                  <div className="space-y-4">
                    {leases.map((l) => (
                      <div key={l.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{l.unit.property.name} <span className="text-sm font-normal text-slate-500">· {l.unit.property.type}</span></p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{l.unit.property.location}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${l.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>{l.status}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><Home className="h-3.5 w-3.5 text-slate-400" /> Unit {l.unit.unitNumber}{l.unit.floor !== null ? ` · Floor ${l.unit.floor}` : ''} · {l.unit.status}</p>
                          <p className="text-slate-600 dark:text-slate-300">Rent: <strong>{formatCurrency(l.unit.monthlyRent, currency)}</strong>/mo</p>
                          <p className="text-slate-600 dark:text-slate-300">Deposit: {formatCurrency(l.unit.depositAmount, currency)}</p>
                          <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><Droplets className="h-3.5 w-3.5 text-slate-400" /> Water: {formatCurrency(l.unit.waterRatePerUnit, currency)}/unit</p>
                          <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {l.startDate.toLocaleDateString()} → {l.endDate.toLocaleDateString()}</p>
                          <p className="text-slate-600 dark:text-slate-300">Bills on day <strong>{l.billingDayOfMonth}</strong> of each month</p>
                        </div>
                        {l.depositAmount > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3 dark:border-white/10">
                            <ShieldCheck className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              Deposit: <strong>{formatCurrency(l.depositAmount, currency)}</strong>
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                              l.depositStatus === 'collected' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : l.depositStatus === 'refunded' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                              : l.depositStatus === 'forfeited' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}>{l.depositStatus}</span>
                            {['pending', 'invoiced'].includes(l.depositStatus) && (
                              <form action={updateDepositStatus} className="inline">
                                <input type="hidden" name="orgId" value={org.id} />
                                <input type="hidden" name="leaseId" value={l.id} />
                                <input type="hidden" name="depositStatus" value="collected" />
                                <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Mark collected</button>
                              </form>
                            )}
                            {l.depositStatus === 'collected' && l.status === 'terminated' && (
                              <>
                                <form action={updateDepositStatus} className="inline">
                                  <input type="hidden" name="orgId" value={org.id} />
                                  <input type="hidden" name="leaseId" value={l.id} />
                                  <input type="hidden" name="depositStatus" value="refunded" />
                                  <button className="rounded-lg border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10">Refund</button>
                                </form>
                                <form action={updateDepositStatus} className="inline">
                                  <input type="hidden" name="orgId" value={org.id} />
                                  <input type="hidden" name="leaseId" value={l.id} />
                                  <input type="hidden" name="depositStatus" value="forfeited" />
                                  <button className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">Forfeit</button>
                                </form>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-violet-500" /> Billing Summary</h3>
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/5"><p className="text-lg font-bold">{formatCurrency(totalBilled, currency)}</p><p className="text-xs text-slate-500 dark:text-slate-400">Billed</p></div>
                  <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalPaid, currency)}</p><p className="text-xs text-emerald-600 dark:text-emerald-400">Paid</p></div>
                  <div className="rounded-xl bg-rose-500/10 p-3"><p className="text-lg font-bold text-rose-700 dark:text-rose-300">{formatCurrency(outstanding, currency)}</p><p className="text-xs text-rose-600 dark:text-rose-400">Outstanding</p></div>
                </div>
                {invoices.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No invoices yet.</p> : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {invoices.slice(0, 15).map((inv) => {
                      const bal = inv.amountDue - inv.amountPaid
                      return (
                        <div key={inv.id} className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40">
                          <div><p className="font-medium">{inv.invoiceNumber}</p><p className="text-xs text-slate-500 dark:text-slate-400">{inv.billingMonth} · due {inv.dueDate.toLocaleDateString()}</p></div>
                          <div className="text-right"><p className="font-semibold">{formatCurrency(bal, currency)}</p><p className="text-xs capitalize text-slate-500 dark:text-slate-400">{inv.status}</p></div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Link href={`/maskani/invoices${orgQuery}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-300">Open invoices <ArrowLeft className="h-3.5 w-3.5 rotate-180" /></Link>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Wrench className="h-5 w-5 text-amber-500" /> Requests & Complaints</h3>
                <div className="mb-4 flex gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${openTickets > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'}`}>{openTickets} open ticket{openTickets === 1 ? '' : 's'}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${openComplaints > 0 ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'}`}>{openComplaints} open complaint{openComplaints === 1 ? '' : 's'}</span>
                </div>
                {tickets.length === 0 && complaints.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No maintenance tickets or complaints from this tenant.</p>
                ) : (
                  <div className="space-y-2">
                    {tickets.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40">
                        <span className="flex items-center gap-1.5 truncate"><Wrench className="h-3.5 w-3.5 shrink-0 text-amber-500" />{t.title}</span>
                        <span className="ml-2 shrink-0 text-xs capitalize text-slate-500 dark:text-slate-400">{t.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                    {complaints.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40">
                        <span className="flex items-center gap-1.5 truncate"><MessageSquareWarning className="h-3.5 w-3.5 shrink-0 text-rose-500" />{c.subject}</span>
                        <span className="ml-2 shrink-0 text-xs capitalize text-slate-500 dark:text-slate-400">{c.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 text-lg font-semibold">Quick links</h3>
                <div className="space-y-2 text-sm">
                  <Link href={`/maskani/invoices${orgQuery}`} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 px-4 py-3 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-white/5"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-violet-500" /> Invoices & payments</span><ArrowLeft className="h-4 w-4 rotate-180 text-slate-400" /></Link>
                  <Link href={`/maskani/maintenance${orgQuery}`} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 px-4 py-3 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-white/5"><span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-amber-500" /> Maintenance tickets</span><ArrowLeft className="h-4 w-4 rotate-180 text-slate-400" /></Link>
                  <Link href={`/maskani/complaints${orgQuery}`} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 px-4 py-3 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-white/5"><span className="flex items-center gap-2"><MessageSquareWarning className="h-4 w-4 text-rose-500" /> Complaints</span><ArrowLeft className="h-4 w-4 rotate-180 text-slate-400" /></Link>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
