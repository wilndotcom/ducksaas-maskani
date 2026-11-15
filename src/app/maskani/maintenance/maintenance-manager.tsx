'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Wrench, Plus, X, Trash2 } from 'lucide-react'
import { createMaintenanceTicket, updateMaintenanceStatus, deleteMaintenanceTicket } from './actions'
import { MobileNav } from '@/components/mobile-nav'

type Ticket = { id: string; title: string; description: string | null; category: string; priority: 'low' | 'medium' | 'high'; status: 'open' | 'in_progress' | 'resolved'; tenantName: string; tenantEmail: string; unitLabel: string; createdAt: string }
type Opt = { id: string; label: string }

export function MaintenanceManager({ organization, orgQuery, roleLabel, tickets, units, members }: { organization: { id: string; name: string }; orgQuery: string; roleLabel: string; tickets: Ticket[]; units: Opt[]; members: Opt[] }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  const run = (fn: () => Promise<void>, success: string, close?: () => void) => startTransition(async () => { try { await fn(); flash(success); close?.() } catch (e) { flash(e instanceof Error ? e.message : 'Action failed') } })

  const stats = useMemo(() => ({ total: tickets.length, open: tickets.filter((t) => t.status === 'open').length, inProgress: tickets.filter((t) => t.status === 'in_progress').length, resolved: tickets.filter((t) => t.status === 'resolved').length }), [tickets])

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance', active: true },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/notifications${orgQuery}`, label: 'Notifications' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-400/25 blur-3xl dark:bg-amber-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-orange-400/25 blur-3xl dark:bg-orange-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={organization.name}>{organization.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">{nav.map((n) => <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>)}</nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={organization.name} />
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/maskani${orgQuery}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-200"><Wrench className="h-3.5 w-3.5" /> Maintenance</p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Maintenance Tickets</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{organization.name} · Role: {roleLabel}</p>
              </div>
              <div className="flex items-center gap-3">{msg && <div className="rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">{msg}</div>}<button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><Plus className="h-4 w-4" /> New Ticket</button></div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Total</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></div>
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 dark:border-rose-500/20 dark:bg-rose-500/10"><p className="text-sm text-rose-700 dark:text-rose-300">Open</p><p className="mt-1 text-2xl font-bold text-rose-700 dark:text-rose-200">{stats.open}</p></div>
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-sm text-amber-700 dark:text-amber-300">In Progress</p><p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-200">{stats.inProgress}</p></div>
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-sm text-emerald-700 dark:text-emerald-300">Resolved</p><p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{stats.resolved}</p></div>
            </div>

            {open && (
              <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Create Maintenance Ticket</h3><button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Required: unit, reporting tenant/member, category, priority, status, and title. Description is optional.</p>
                <form action={(fd) => { fd.set('orgId', organization.id); run(() => createMaintenanceTicket(fd), 'Ticket created', () => setOpen(false)) }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div><label className="mb-1 block text-sm font-medium">Unit *</label><select name="unitId" required className={inputCls}><option value="">Select unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
                  <div><label className="mb-1 block text-sm font-medium">Reported by (member/tenant) *</label><select name="tenantUserId" required className={inputCls}><option value="">Select member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
                  <div><label className="mb-1 block text-sm font-medium">Category *</label><select name="category" required className={inputCls} defaultValue="other"><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="other">Other</option></select></div>
                  <div><label className="mb-1 block text-sm font-medium">Priority *</label><select name="priority" required className={inputCls} defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                  <div><label className="mb-1 block text-sm font-medium">Status *</label><select name="status" required className={inputCls} defaultValue="open"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div>
                  <div className="sm:col-span-2 lg:col-span-3"><label className="mb-1 block text-sm font-medium">Title *</label><input name="title" required className={inputCls} placeholder="Short issue summary" /></div>
                  <div className="sm:col-span-2 lg:col-span-3"><label className="mb-1 block text-sm font-medium">Description</label><textarea name="description" rows={3} className={inputCls} placeholder="Details, access notes, etc." /></div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button><button type="submit" disabled={pending || units.length === 0 || members.length === 0} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Saving...' : 'Create Ticket'}</button></div>
                </form>
                {(units.length === 0 || members.length === 0) && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">You need at least one unit and one organization member to create a ticket.</p>}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-4 text-lg font-semibold">Tickets</h3>
              {tickets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">No maintenance tickets yet for {organization.name}. Create one to track issues by unit, tenant, priority, and status.</div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div key={t.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{t.unitLabel} · Reported by {t.tenantName} ({t.tenantEmail})</p>
                          {t.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-slate-500/15 px-2.5 py-1 capitalize text-slate-700 dark:text-slate-300">{t.category}</span>
                            <span className={`rounded-full px-2.5 py-1 capitalize ${t.priority === 'high' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : t.priority === 'medium' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'}`}>{t.priority} priority</span>
                            <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-slate-600 dark:text-slate-300">{t.createdAt}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select defaultValue={t.status} onChange={(e) => { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', t.id); fd.set('status', e.target.value); run(() => updateMaintenanceStatus(fd), 'Ticket updated') }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-white/10 dark:bg-slate-900/60">
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          <button onClick={() => { if (confirm('Delete this ticket?')) { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', t.id); run(() => deleteMaintenanceTicket(fd), 'Ticket deleted') } }} className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
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
