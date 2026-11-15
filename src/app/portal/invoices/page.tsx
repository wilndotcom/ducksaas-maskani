import { resolveTenantContext } from '@/lib/portal'
import { prisma } from '@/lib/prisma'
import { getOrgGateways } from '@/lib/payments'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'
import { cookies } from 'next/headers'
import { FileText } from 'lucide-react'
import { InvoicesPayClient } from './pay-client'
import { StatusBadge } from '@/components/status-badge'

export const instant = false

export default async function PortalInvoices() {
  const { session, org } = await resolveTenantContext()
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [invoices, gateways, pendingSessions] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: org.id, tenantUserId: session.user.id },
      orderBy: { dueDate: 'desc' },
      include: {
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        payments: { orderBy: { paidAt: 'desc' }, take: 3, select: { id: true, amount: true, paymentMethod: true, paidAt: true, gatewayReference: true } },
      },
    }),
    getOrgGateways(org.id),
    prisma.paymentSession.findMany({
      where: { organizationId: org.id, tenantUserId: session.user.id, status: 'pending' },
      select: { invoiceId: true },
    }),
  ])

  const providers = gateways.map((g) => ({
    provider: g.provider,
    accountNumber: g.accountNumber,
    isMpesa: g.provider === 'mpesa_paybill' || g.provider === 'mpesa_till',
  }))
  const pendingInvoiceIds = new Set(pendingSessions.map((s) => s.invoiceId))

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-200"><FileText className="h-3.5 w-3.5" /> Rent & Invoices</p>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">My Invoices</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name} · View balances and pay online</p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-10 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          No invoices yet. Your landlord will issue invoices here when rent is due.
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const balance = inv.amountDue - inv.amountPaid
            const payable = inv.status !== 'paid' && balance > 0 && !pendingInvoiceIds.has(inv.id)
            const pending = pendingInvoiceIds.has(inv.id)
            return (
              <div key={inv.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{inv.invoiceNumber}</h3>
                      <StatusBadge status={inv.status} dueDate={inv.dueDate} />
                      {pending && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">Payment pending</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {inv.unit.property.name} · Unit {inv.unit.unitNumber} · {inv.billingMonth} · Due {new Date(inv.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatCurrency(balance, currency)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">of {formatCurrency(inv.amountDue, currency)} · paid {formatCurrency(inv.amountPaid, currency)}</p>
                    {inv.waterAmount > 0 && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">includes {formatCurrency(inv.waterAmount, currency)} water</p>}
                  </div>
                </div>

                {inv.payments.length > 0 && (
                  <div className="mt-4 border-t border-slate-200/70 pt-3 dark:border-white/10">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Payments</p>
                    <div className="space-y-1">
                      {inv.payments.map((p) => (
                        <p key={p.id} className="text-sm text-slate-600 dark:text-slate-300">
                          {formatCurrency(p.amount, currency)} · {p.paymentMethod.replace('_', ' ')} · {new Date(p.paidAt).toLocaleDateString()}
                          {p.gatewayReference ? <span className="text-xs text-slate-400"> · ref {p.gatewayReference}</span> : null}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {payable && providers.length > 0 && (
                  <InvoicesPayClient invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} balance={balance} providers={providers} />
                )}
                {payable && providers.length === 0 && (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
                    Online payment is not configured for this organization yet. Please pay via your landlord&apos;s usual channel.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


