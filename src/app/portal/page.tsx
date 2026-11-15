import { resolveTenantContext } from '@/lib/portal'
import { prisma } from '@/lib/prisma'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'
import { cookies } from 'next/headers'
import { startOfMonth } from 'date-fns'
import Link from 'next/link'
import { Wallet, FileText, Wrench, Home, ArrowRight, AlertCircle } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'

export const instant = false

export default async function PortalDashboard() {
  const { session, org, unit } = await resolveTenantContext()
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [allInvoices, openTickets, paidThisMonth] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: org.id, tenantUserId: session.user.id },
      orderBy: { dueDate: 'asc' },
      select: { id: true, invoiceNumber: true, billingMonth: true, amountDue: true, amountPaid: true, dueDate: true, status: true },
    }),
    prisma.maintenanceTicket.count({
      where: { organizationId: org.id, tenantUserId: session.user.id, status: { in: ['open', 'in_progress'] } },
    }),
    prisma.rentPayment.aggregate({
      _sum: { amount: true },
      where: { organizationId: org.id, tenantUserId: session.user.id, paidAt: { gte: startOfMonth(new Date()) } },
    }),
  ])

  const invoices = allInvoices.slice(0, 5)
  const totalOutstanding = allInvoices
    .filter((i) => i.status !== 'paid')
    .reduce((s, i) => s + (i.amountDue - i.amountPaid), 0)
  const overdueCount = allInvoices.filter((i) => i.status === 'overdue' || (i.status !== 'paid' && i.dueDate < new Date())).length

  const cards = [
    { label: 'Outstanding Balance', value: totalOutstanding, icon: Wallet, tone: 'from-rose-500 to-orange-500', hint: `${overdueCount} overdue` },
    { label: 'Open Requests', value: openTickets, icon: Wrench, tone: 'from-amber-500 to-yellow-500', hint: 'Maintenance & complaints' },
    { label: 'Paid This Month', value: paidThisMonth._sum.amount ?? 0, icon: FileText, tone: 'from-emerald-500 to-teal-500', hint: 'Rent payments' },
  ]

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200"><Home className="h-3.5 w-3.5" /> Tenant Portal</p>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Hello, {session.user.name}</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {org.name}{unit ? ` · ${unit.propertyName} · Unit ${unit.unitNumber}` : ''}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.tone} p-[1px] shadow-xl`}>
              <div className="rounded-2xl bg-white/90 p-5 backdrop-blur dark:bg-slate-900/60">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white`}><Icon className="h-5 w-5" /></span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{typeof c.value === 'number' && c.label !== 'Open Requests' ? formatCurrency(c.value, currency) : c.value}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.hint}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Recent Invoices</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your latest rent invoices</p>
          </div>
          <Link href="/portal/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-300">View all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-300">No invoices yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-200/70 dark:border-white/10">
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {invoices.map((inv) => {
                  const balance = inv.amountDue - inv.amountPaid
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                      <td className="px-3 py-3 font-medium">{inv.invoiceNumber}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{inv.billingMonth}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="px-3 py-3 font-medium">{formatCurrency(balance, currency)}</td>
                      <td className="px-3 py-3"><StatusBadge status={inv.status} dueDate={inv.dueDate} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalOutstanding > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" /> You have {formatCurrency(totalOutstanding, currency)} outstanding.{' '}
            <Link href="/portal/invoices" className="font-semibold underline">Pay now</Link>
          </div>
        )}
      </div>
    </div>
  )
}



