import { ScrollText, Receipt, Wrench, MessageSquareWarning, Building2, CreditCard } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const instant = false

type LogItem = { id: string; at: Date; type: string; title: string; detail: string; org?: string; tone: string }

export default async function LogsPage() {
  const [ledger, payments, tickets, complaints, orgs] = await Promise.all([
    prisma.saaSSubscriptionLedger.findMany({ take: 15, orderBy: { createdAt: 'desc' }, include: { organization: { select: { name: true } }, plan: { select: { name: true } } } }),
    prisma.rentPayment.findMany({ take: 15, orderBy: { paidAt: 'desc' }, include: { organization: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } } }),
    prisma.maintenanceTicket.findMany({ take: 15, orderBy: { updatedAt: 'desc' }, include: { organization: { select: { name: true } }, unit: { select: { unitNumber: true } } } }),
    prisma.complaint.findMany({ take: 15, orderBy: { updatedAt: 'desc' }, include: { organization: { select: { name: true } } } }),
    prisma.organization.findMany({ take: 10, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, status: true, updatedAt: true, subscriptionEndsAt: true } }),
  ])

  const items: LogItem[] = []
  for (const l of ledger) items.push({ id: `ledger-${l.id}`, at: l.createdAt, type: 'Subscription', title: `Ledger: ${l.plan.name}`, detail: `${l.amount} via ${l.gateway || 'gateway'} · ${l.status} · ref ${l.transactionRef}`, org: l.organization.name, tone: 'emerald' })
  for (const p of payments) items.push({ id: `pay-${p.id}`, at: p.paidAt, type: 'Rent Payment', title: `Payment ${p.invoice.invoiceNumber}`, detail: `${p.amount} · ${p.paymentMethod}${p.gatewayReference ? ` · ${p.gatewayReference}` : ''}`, org: p.organization.name, tone: 'cyan' })
  for (const t of tickets) items.push({ id: `ticket-${t.id}`, at: t.updatedAt, type: 'Maintenance', title: t.title, detail: `Status: ${t.status} · Priority: ${t.priority}${t.unit ? ` · Unit ${t.unit.unitNumber}` : ''}`, org: t.organization.name, tone: 'amber' })
  for (const c of complaints) items.push({ id: `complaint-${c.id}`, at: c.updatedAt, type: 'Complaint', title: c.subject, detail: `Status: ${c.status} · Priority: ${c.priority}`, org: c.organization.name, tone: 'rose' })
  for (const o of orgs) items.push({ id: `org-${o.id}-${o.updatedAt.getTime()}`, at: o.updatedAt, type: 'Organization', title: o.name, detail: `Status: ${o.status}${o.subscriptionEndsAt ? ` · ends ${o.subscriptionEndsAt.toISOString().slice(0,10)}` : ''}`, org: o.name, tone: 'violet' })

  items.sort((a, b) => b.at.getTime() - a.at.getTime())
  const feed = items.slice(0, 40)

  const counts = [
    { label: 'Subscription Events', value: ledger.length, icon: CreditCard },
    { label: 'Rent Payments', value: payments.length, icon: Receipt },
    { label: 'Maintenance Updates', value: tickets.length, icon: Wrench },
    { label: 'Complaint Updates', value: complaints.length, icon: MessageSquareWarning },
    { label: 'Org Updates', value: orgs.length, icon: Building2 },
  ]

  const toneCls: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    cyan: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg"><ScrollText className="h-5 w-5" /></span>
          System Logs
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Unified activity feed from subscriptions, payments, maintenance, complaints, and organizations (most recent 40).</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {counts.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p><Icon className="h-4 w-4 text-slate-500" /></div>
              <p className="text-xl font-bold">{c.value}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
        {feed.length === 0 ? (
          <p className="text-sm text-slate-500">No activity records found yet.</p>
        ) : (
          <div className="space-y-3">
            {feed.map((e) => (
              <div key={e.id} className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/60 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10 dark:bg-slate-900/40">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneCls[e.tone] || 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>{e.type}</span>
                    {e.org && <span className="text-xs text-slate-500 dark:text-slate-400">{e.org}</span>}
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{e.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 break-words">{e.detail}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{e.at.toISOString().replace('T', ' ').slice(0, 16)} UTC</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Note: this view aggregates recent records from core tables. Add a dedicated audit/event log table for immutable system-level audit trails and admin actions.</p>
      </div>
    </div>
  )
}
