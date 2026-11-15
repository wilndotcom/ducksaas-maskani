import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { MessageSquareWarning, Sparkles, ArrowLeft, Plus, AlertCircle, Clock3, CheckCircle2 } from 'lucide-react'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import { createComplaint, updateComplaintStatus } from './actions'
import { MobileNav } from '@/components/mobile-nav'

export const instant = false

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await getServerSession(authOptions)
  const { org: orgParam } = await searchParams

  if (!session) redirect('/auth/signin')

  let org
  let roleLabel = ''

  if (session.user.globalRole === 'super_admin') {
    if (!orgParam) redirect('/ducksaas')
    org = await prisma.organization.findUnique({ where: { id: orgParam }, select: { id: true, name: true, status: true, slug: true } })
    if (!org) redirect('/ducksaas/organizations')
    const sub = await syncOrganizationSubscription(org.id)
    roleLabel = `super_admin (viewing, ${sub.isSuspended ? 'suspended' : sub.isGracePeriod ? 'grace period' : 'active'})`
  } else {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: { organization: { select: { id: true, name: true, status: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) redirect('/auth/register')
    org = membership.organization
    const sub = await syncOrganizationSubscription(org.id)
    if (sub.isSuspended) redirect('/maskani/suspended')
    roleLabel = membership.role.replace('_', ' ') + (sub.isGracePeriod ? ' (grace period, read-only)' : '')
  }

  const orgQuery = orgParam && session.user.globalRole === 'super_admin' ? `?org=${org.id}` : ''

  const [complaints, units, tenants] = await Promise.all([
    prisma.complaint.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        unit: { select: { id: true, unitNumber: true, property: { select: { name: true } } } },
      },
    }),
    prisma.unit.findMany({ where: { organizationId: org.id }, select: { id: true, unitNumber: true, property: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.organizationMember.findMany({ where: { organizationId: org.id, role: 'tenant' }, include: { user: { select: { id: true, name: true, email: true } } }, take: 100 }),
  ])

  const openCount = complaints.filter((c) => c.status === 'open').length
  const inProgressCount = complaints.filter((c) => c.status === 'in_progress').length
  const resolvedCount = complaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints', active: true },
    { href: `/maskani/notifications${orgQuery}`, label: 'Notifications' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-rose-400/25 blur-3xl dark:bg-rose-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-500/20" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-500/15" />
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
              <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
            <a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={org.name} />
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/maskani${orgQuery}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                  <ArrowLeft className="h-4 w-4" /> Back to dashboard
                </Link>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-200">
                  <MessageSquareWarning className="h-3.5 w-3.5" /> Complaints Center
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Complaints</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name} · Role: {roleLabel}</p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-3 flex items-center justify-between"><p className="text-sm text-slate-500 dark:text-slate-400">Open</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300"><AlertCircle className="h-5 w-5" /></span></div>
                <p className="text-3xl font-bold">{openCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-3 flex items-center justify-between"><p className="text-sm text-slate-500 dark:text-slate-400">In Progress</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300"><Clock3 className="h-5 w-5" /></span></div>
                <p className="text-3xl font-bold">{inProgressCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-3 flex items-center justify-between"><p className="text-sm text-slate-500 dark:text-slate-400">Resolved/Closed</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /></span></div>
                <p className="text-3xl font-bold">{resolvedCount}</p>
              </div>
            </div>

            <div className="mb-8 rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Plus className="h-5 w-5" /> Log a Complaint</h3>
              <form action={createComplaint} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input type="hidden" name="orgId" value={session.user.globalRole === 'super_admin' ? org.id : ''} />
                <input name="subject" required placeholder="Subject" className="rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60" />
                <select name="priority" defaultValue="medium" className="rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
                <select name="unitId" defaultValue="" className="rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60">
                  <option value="">Unit (optional)</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.property.name} - {u.unitNumber}</option>)}
                </select>
                <select name="tenantUserId" defaultValue="" className="rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60">
                  <option value="">Tenant (optional)</option>
                  {tenants.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</option>)}
                </select>
                <textarea name="description" required placeholder="Describe the complaint..." className="md:col-span-2 rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60" rows={3} />
                <div className="md:col-span-2"><button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20"><Plus className="h-4 w-4" /> Submit Complaint</button></div>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-4 text-lg font-semibold">Recent Complaints</h3>
              {complaints.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No complaints recorded yet for <strong>{org.name}</strong>.</p>
              ) : (
                <div className="space-y-3">
                  {complaints.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{c.subject}</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{c.description}</p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.unit ? `${c.unit.property.name} - ${c.unit.unitNumber}` : 'No unit'} · {c.tenant?.name || c.tenant?.email || 'No tenant'} · {c.createdAt.toISOString().slice(0, 10)}</p>
                        </div>
                        <form action={updateComplaintStatus} className="flex items-center gap-2">
                          <input type="hidden" name="orgId" value={session.user.globalRole === 'super_admin' ? org.id : ''} />
                          <input type="hidden" name="id" value={c.id} />
                          <select name="status" defaultValue={c.status} className="rounded-lg border border-slate-300/70 bg-white/80 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900/60">
                            <option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option><option value="closed">closed</option>
                          </select>
                          <button className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">Update</button>
                        </form>
                      </div>
                      {c.resolutionNote ? <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Resolution: {c.resolutionNote}</p> : null}
                    </div>
                  ))}
                </div>
              )}
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
