'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowLeft, CreditCard, Plus, X, Receipt, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { createInvoice, recordPayment } from './actions'

type Payment = { id: string; amount: number; method: string; reference: string | null; paidAt: string }
type Invoice = { id: string; invoiceNumber: string; billingMonth: string; amountDue: number; amountPaid: number; waterAmount: number; dueDate: string; status: 'unpaid' | 'partial' | 'paid' | 'overdue'; tenantName: string; tenantEmail: string; unitLabel: string; payments: Payment[] }
type LeaseOpt = { id: string; label: string; monthlyRent: number }

export function InvoicesManager({ organization, orgQuery, roleLabel, invoices, leases, currency }: { organization: { id: string; name: string }; orgQuery: string; roleLabel: string; invoices: Invoice[]; leases: LeaseOpt[]; currency: string }) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [payFor, setPayFor] = useState<Invoice | null>(null)
  const [selectedLease, setSelectedLease] = useState('')
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  const run = (fn: () => Promise<void>, success: string, close?: () => void) => startTransition(async () => { try { await fn(); flash(success); close?.() } catch (e) { flash(e instanceof Error ? e.message : 'Action failed') } })

  const stats = useMemo(() => {
    const due = invoices.reduce((s, i) => s + i.amountDue, 0)
    const paid = invoices.reduce((s, i) => s + i.amountPaid, 0)
    const outstanding = invoices.reduce((s, i) => s + Math.max(0, i.amountDue - i.amountPaid), 0)
    const unpaidCount = invoices.filter((i) => i.status !== 'paid').length
    return { due, paid, outstanding, unpaidCount, total: invoices.length }
  }, [invoices])

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices', active: true },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings' },
  ]

  const selectedRent = leases.find((l) => l.id === selectedLease)?.monthlyRent ?? ''

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={organization.name}>{organization.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">{nav.map((n) => <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>)}</nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/maskani${orgQuery}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-200"><CreditCard className="h-3.5 w-3.5" /> Rent & Invoices</p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Rent & Invoices</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{organization.name} · Role: {roleLabel}</p>
              </div>
              <div className="flex items-center gap-3">{msg && <div className="rounded-xl bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300">{msg}</div>}<button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><Plus className="h-4 w-4" /> Create Invoice</button></div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Invoices</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Total Due</p><p className="mt-1 text-2xl font-bold">{fmt(stats.due)}</p></div>
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-sm text-emerald-700 dark:text-emerald-300">Collected</p><p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{fmt(stats.paid)}</p></div>
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 dark:border-rose-500/20 dark:bg-rose-500/10"><p className="text-sm text-rose-700 dark:text-rose-300">Outstanding</p><p className="mt-1 text-2xl font-bold text-rose-700 dark:text-rose-200">{fmt(stats.outstanding)}</p></div>
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-sm text-amber-700 dark:text-amber-300">Unpaid/Partial</p><p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-200">{stats.unpaidCount}</p></div>
            </div>

            {showCreate && (
              <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Create Invoice</h3><button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Required: active lease, billing month (e.g. 2026-11), amount due, due date. Invoice is generated with a unique number for this organization.</p>
                <form action={(fd) => { fd.set('orgId', organization.id); run(() => createInvoice(fd), 'Invoice created', () => { setShowCreate(false); setSelectedLease('') }) }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Active lease *</label><select name="leaseId" required className={inputCls} value={selectedLease} onChange={(e) => setSelectedLease(e.target.value)}><option value="">Select lease</option>{leases.map((l) => <option key={l.id} value={l.id}>{l.label} (rent {formatCurrency(l.monthlyRent, currency)})</option>)}</select></div>
                  <div><label className="mb-1 block text-sm font-medium">Billing month *</label><input name="billingMonth" required className={inputCls} placeholder="YYYY-MM" /></div>
                  <div><label className="mb-1 block text-sm font-medium">Amount due *</label><input name="amountDue" type="number" min={0.01} step="0.01" required className={inputCls} defaultValue={selectedRent} /></div>
                  <div><label className="mb-1 block text-sm font-medium">Due date *</label><input name="dueDate" type="date" required className={inputCls} /></div>
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button><button type="submit" disabled={pending || leases.length === 0} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Saving...' : 'Create Invoice'}</button></div>
                </form>
                {leases.length === 0 && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">No active leases found. Create a lease in Tenants & Leases first.</p>}
              </div>
            )}

            {payFor && (
              <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Record Payment — {payFor.invoiceNumber}</h3><button onClick={() => setPayFor(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Outstanding balance: <strong>{fmt(Math.max(0, payFor.amountDue - payFor.amountPaid))}</strong> for {payFor.tenantName} ({payFor.unitLabel}).</p>
                <form action={(fd) => { fd.set('orgId', organization.id); fd.set('invoiceId', payFor.id); run(() => recordPayment(fd), 'Payment recorded', () => setPayFor(null)) }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><label className="mb-1 block text-sm font-medium">Amount *</label><input name="amount" type="number" min={0.01} step="0.01" required className={inputCls} defaultValue={Math.max(0, payFor.amountDue - payFor.amountPaid)} /></div>
                  <div><label className="mb-1 block text-sm font-medium">Payment method *</label><select name="paymentMethod" required className={inputCls} defaultValue="cash_manual"><option value="cash_manual">Cash (manual)</option><option value="bank_transfer">Bank transfer</option><option value="mpesa_stk">M-Pesa STK</option><option value="mpesa_c2b">M-Pesa C2B</option><option value="card">Card</option></select></div>
                  <div><label className="mb-1 block text-sm font-medium">Gateway/reference</label><input name="gatewayReference" className={inputCls} placeholder="Optional reference" /></div>
                  <div><label className="mb-1 block text-sm font-medium">Paid at</label><input name="paidAt" type="datetime-local" className={inputCls} /></div>
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3"><button type="button" onClick={() => setPayFor(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button><button type="submit" disabled={pending} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving...' : 'Record Payment'}</button></div>
                </form>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Receipt className="h-5 w-5 text-violet-500" /> Invoices</h3>
              {invoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">No invoices yet. Create an invoice for an active lease to start tracking rent and payments for {organization.name}.</div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => {
                    const balance = Math.max(0, inv.amountDue - inv.amountPaid)
                    const effectiveStatus = inv.status === 'unpaid' && inv.dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : inv.status
                    return (
                      <div key={inv.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{inv.invoiceNumber} <span className="ml-2 text-sm font-normal text-slate-500">· {inv.billingMonth}</span></p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{inv.tenantName} · {inv.unitLabel}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Due {inv.dueDate} · {inv.tenantEmail}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Due {fmt(inv.amountDue)}{inv.waterAmount > 0 ? ` (rent ${fmt(inv.amountDue - inv.waterAmount)} + water ${fmt(inv.waterAmount)})` : ''} · Paid {fmt(inv.amountPaid)}</p>
                            <p className={`text-lg font-bold ${balance > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>Balance {fmt(balance)}</p>
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${effectiveStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : effectiveStatus === 'partial' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : effectiveStatus === 'overdue' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-orange-500/15 text-orange-700 dark:text-orange-300'}`}>{effectiveStatus}</span>
                              {balance > 0 && <button onClick={() => setPayFor(inv)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Wallet className="h-3.5 w-3.5" /> Record Payment</button>}
                            </div>
                          </div>
                        </div>
                        {inv.payments.length > 0 && (
                          <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Payments</p>
                            <div className="flex flex-wrap gap-2">{inv.payments.map((p) => <span key={p.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">{p.paidAt} · {fmt(p.amount)} · {p.method.replace('_', ' ')}{p.reference ? ` · ${p.reference}` : ''}</span>)}</div>
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
