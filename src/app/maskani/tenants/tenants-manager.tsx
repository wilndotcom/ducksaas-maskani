'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Users, Plus, X, Trash2, Ban, CheckCircle2, Mail, Phone, Home, Calendar, Droplets } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { createLease, updateLeaseStatus, deleteLease } from './actions'
import { recordWaterReading, deleteWaterReading } from '../utilities/actions'
import { MobileNav } from '@/components/mobile-nav'

type Lease = { id: string; unitId: string; tenantName: string; tenantEmail: string; tenantPhone: string | null; unitLabel: string; startDate: string; endDate: string; billingDayOfMonth: number; status: 'active' | 'terminated' }
type UnitOpt = { id: string; label: string }
type Tenant = { id: string; name: string; email: string; phone: string | null }
type WaterUnit = { id: string; label: string; rate: number }
type WaterReading = { id: string; unitId: string; periodMonth: string; meterReading: number; unitsConsumed: number; ratePerUnit: number; amount: number; billed: boolean }

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export function TenantsManager({ organization, orgQuery, roleLabel, leases, units, tenants, waterUnits, waterReadings, currency }: { organization: { id: string; name: string }; orgQuery: string; roleLabel: string; leases: Lease[]; units: UnitOpt[]; tenants: Tenant[]; waterUnits: WaterUnit[]; waterReadings: WaterReading[]; currency: string }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  const run = (fn: () => Promise<void>, success: string, close?: () => void) => startTransition(async () => { try { await fn(); flash(success); close?.() } catch (e) { flash(e instanceof Error ? e.message : 'Action failed') } })

  const stats = useMemo(() => ({ total: leases.length, active: leases.filter((l) => l.status === 'active').length, terminated: leases.filter((l) => l.status === 'terminated').length, tenantMembers: tenants.length }), [leases, tenants])

  const latestReadingByUnit = useMemo(() => {
    const map = new Map<string, WaterReading>()
    for (const r of waterReadings) if (!map.has(r.unitId)) map.set(r.unitId, r)
    return map
  }, [waterReadings])
  const unbilledTotal = useMemo(() => waterReadings.filter((r) => !r.billed).reduce((s, r) => s + r.amount, 0), [waterReadings])

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases', active: true },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={organization.name}>{organization.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">{nav.map((n) => <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>)}</nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={organization.name} />
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/maskani${orgQuery}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-200"><Users className="h-3.5 w-3.5" /> Tenants & Leases</p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Tenants & Leases</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{organization.name} · Role: {roleLabel}</p>
              </div>
              <div className="flex items-center gap-3">{msg && <div className="rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-300">{msg}</div>}<button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><Plus className="h-4 w-4" /> Add Lease</button></div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Total Leases</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></div>
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-sm text-emerald-700 dark:text-emerald-300">Active</p><p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{stats.active}</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Terminated</p><p className="mt-1 text-2xl font-bold">{stats.terminated}</p></div>
              <div className="rounded-2xl border border-fuchsia-200/70 bg-fuchsia-50/70 p-4 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10"><p className="text-sm text-fuchsia-700 dark:text-fuchsia-300">Tenant Members</p><p className="mt-1 text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-200">{stats.tenantMembers}</p></div>
            </div>

            {open && (
              <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Add Lease</h3><button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Required: unit, tenant email, start/end dates, billing day (1-28). If the tenant has no account yet, fill in their name and a password to create one — they can then sign in to the tenant portal.</p>
                <form action={(fd) => { fd.set('orgId', organization.id); run(() => createLease(fd), 'Lease created', () => setOpen(false)) }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-3"><label className="mb-1 block text-sm font-medium">Unit *</label><select name="unitId" required className={inputCls}><option value="">Select unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
                  <div><label className="mb-1 block text-sm font-medium">Tenant email *</label><input name="tenantEmail" type="email" required className={inputCls} placeholder="tenant@example.com" /></div>
                  <div><label className="mb-1 block text-sm font-medium">Tenant name <span className="text-slate-400">(required if new account)</span></label><input name="tenantName" className={inputCls} placeholder="Jane Doe" /></div>
                  <div><label className="mb-1 block text-sm font-medium">Tenant phone</label><input name="tenantPhone" className={inputCls} placeholder="+254..." /></div>
                  <div><label className="mb-1 block text-sm font-medium">Password <span className="text-slate-400">(required if new account, min 8 chars)</span></label><input name="tenantPassword" type="password" className={inputCls} placeholder="Leave blank if account exists" /></div>
                  <div><label className="mb-1 block text-sm font-medium">Start date *</label><input name="startDate" type="date" required className={inputCls} /></div>
                  <div><label className="mb-1 block text-sm font-medium">End date *</label><input name="endDate" type="date" required className={inputCls} /></div>
                  <div><label className="mb-1 block text-sm font-medium">Billing day of month (1-28) *</label><input name="billingDayOfMonth" type="number" min={1} max={28} defaultValue={1} required className={inputCls} /></div>
                  <div><label className="mb-1 block text-sm font-medium">Status *</label><select name="status" defaultValue="active" className={inputCls}><option value="active">Active</option><option value="terminated">Terminated</option></select></div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button><button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Saving...' : 'Create Lease'}</button></div>
                </form>
                {tenants.length > 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Known tenant members in this org: {tenants.map((t) => t.email).join(', ')}</p>}
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 text-lg font-semibold">Leases</h3>
                {leases.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">No leases yet. Add properties and units first, then create a lease — you can create the tenant&apos;s portal account at the same time.</div>
                ) : (
                  <div className="space-y-3">
                    {leases.map((l) => (
                      <div key={l.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">{l.tenantName}</p>
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{l.tenantEmail}</span>{l.tenantPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{l.tenantPhone}</span>}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5" />{l.unitLabel}</span><span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{l.startDate} → {l.endDate}</span><span>Bill day: {l.billingDayOfMonth}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${l.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>{l.status}</span>
                          <button onClick={() => { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', l.id); fd.set('status', l.status === 'active' ? 'terminated' : 'active'); run(() => updateLeaseStatus(fd), 'Lease updated') }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">{l.status === 'active' ? <><Ban className="h-3.5 w-3.5" />Terminate</> : <><CheckCircle2 className="h-3.5 w-3.5" />Activate</>}</button>
                          <button onClick={() => { if (confirm('Delete this lease?')) { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', l.id); run(() => deleteLease(fd), 'Lease deleted') } }} className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-4 text-lg font-semibold">Tenant Members</h3>
                {tenants.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No tenant members yet. Tenants are added to this organization when you create a lease for their account.</p> : (
                  <div className="space-y-3">{tenants.map((t) => (<div key={t.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-slate-900/40"><p className="font-medium">{t.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{t.email}</p>{t.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{t.phone}</p>}</div>))}</div>
                )}
                <div className="mt-4 rounded-xl border border-cyan-200/60 bg-cyan-500/10 p-3 text-xs text-cyan-800 dark:border-cyan-500/20 dark:text-cyan-200">To add a tenant, enter their email. If they don&apos;t have an account yet, also provide their name and a password — a tenant portal account will be created automatically.</div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold"><Droplets className="h-5 w-5 text-cyan-500" /> Water Billing</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Record monthly meter readings for occupied units. Readings are rolled into the unit&apos;s rent invoice on the billing day. Set each unit&apos;s water rate (price per unit consumed) in Properties &amp; Units.</p>
                </div>
                {unbilledTotal > 0 && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">Unbilled water charges: {formatCurrency(unbilledTotal, currency)}</span>}
              </div>
              {waterUnits.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">No occupied units to bill for water. Create an active lease first.</p>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {waterUnits.map((u) => {
                    const latest = latestReadingByUnit.get(u.id)
                    const readings = waterReadings.filter((r) => r.unitId === u.id).slice(0, 6)
                    return (
                      <div key={u.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{u.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Rate: {formatCurrency(u.rate, currency)} per unit{u.rate === 0 ? ' — set a rate in Properties & Units' : ''}</p>
                          </div>
                          {latest && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${latest.billed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>{latest.billed ? 'Billed' : 'Unbilled'}</span>}
                        </div>
                        {latest && (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Latest: {latest.periodMonth} · meter {latest.meterReading} · used {latest.unitsConsumed} · {formatCurrency(latest.amount, currency)}
                          </p>
                        )}
                        <form action={(fd) => { fd.set('orgId', organization.id); fd.set('unitId', u.id); run(() => recordWaterReading(fd), 'Reading recorded') }} className="mt-3 flex flex-wrap items-end gap-2">
                          <div><label className="mb-1 block text-xs font-medium">Period</label><input name="periodMonth" type="month" required defaultValue={currentMonth()} className={`${inputCls} w-36`} /></div>
                          <div className="flex-1"><label className="mb-1 block text-xs font-medium">Meter reading</label><input name="meterReading" type="number" min={0} step="0.01" required className={inputCls} placeholder="e.g. 123.4" /></div>
                          <button type="submit" disabled={pending} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{pending ? 'Saving…' : latest ? 'Update' : 'Record'}</button>
                        </form>
                        {readings.length > 0 && (
                          <div className="mt-3 space-y-1 border-t border-slate-200/70 pt-2 dark:border-white/10">
                            {readings.map((r) => (
                              <div key={r.id} className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>{r.periodMonth} · {r.unitsConsumed} units · {formatCurrency(r.amount, currency)}{r.billed ? ' · billed' : ''}</span>
                                {!r.billed && <button onClick={() => { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', r.id); run(() => deleteWaterReading(fd), 'Reading deleted') }} className="text-rose-500 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
