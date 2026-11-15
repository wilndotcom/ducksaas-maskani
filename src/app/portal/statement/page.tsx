import { resolveTenantContext } from '@/lib/portal'
import { prisma } from '@/lib/prisma'
import { formatCurrency, getSavedCurrency } from '@/lib/currency'
import { cookies } from 'next/headers'
import { Receipt, Droplets } from 'lucide-react'
import { PrintButton } from './print-button'

export const instant = false

export default async function PortalStatement() {
  const { session, org } = await resolveTenantContext()
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const payments = await prisma.rentPayment.findMany({
    where: { organizationId: org.id, tenantUserId: session.user.id },
    orderBy: { paidAt: 'asc' },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          billingMonth: true,
          unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        },
      },
    },
  })

  const waterReadings = await prisma.waterReading.findMany({
    where: { organizationId: org.id, lease: { tenantUserId: session.user.id } },
    orderBy: { periodMonth: 'desc' },
    take: 12,
    include: { unit: { select: { unitNumber: true, property: { select: { name: true } } } } },
  })

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const firstPaidAt = payments[0]?.paidAt ?? null
  const generatedAt = new Date()

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200"><Receipt className="h-3.5 w-3.5" /> Payment Statement</p>
          <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Payment Statement</h2>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{org.name} · All payments from your first payment to date</p>
        </div>
        <PrintButton />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5 print:border-0 print:bg-white print:shadow-none print:text-slate-900">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6 dark:border-white/10 print:border-slate-300">
          <div>
            <h3 className="text-xl font-bold">{org.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Payment statement</p>
          </div>
          <div className="text-right text-sm">
            <p><span className="text-slate-500 dark:text-slate-400">Tenant:</span> <strong>{session.user.name || 'Tenant'}</strong></p>
            <p><span className="text-slate-500 dark:text-slate-400">Email:</span> {session.user.email}</p>
            <p className="mt-1"><span className="text-slate-500 dark:text-slate-400">Period:</span> {firstPaidAt ? `${firstPaidAt.toLocaleDateString()} — ${generatedAt.toLocaleDateString()}` : 'No payments yet'}</p>
            <p className="text-xs text-slate-400">Generated {generatedAt.toLocaleString()}</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No payments recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Invoice</th>
                  <th className="pb-2 pr-4">Unit</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Reference</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2.5 pr-4">{p.paidAt.toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 font-medium">{p.invoice?.invoiceNumber || '—'}</td>
                    <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">
                      {p.invoice ? `${p.invoice.unit.property.name} · ${p.invoice.unit.unitNumber}` : '—'}
                      {p.invoice?.billingMonth ? <span className="ml-1 text-xs">({p.invoice.billingMonth})</span> : null}
                    </td>
                    <td className="py-2.5 pr-4 capitalize">{p.paymentMethod.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400">{p.receiptNumber || p.gatewayReference || '—'}</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(p.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-white/20">
                  <td colSpan={5} className="pt-3 text-right font-bold">Total paid</td>
                  <td className="pt-3 text-right text-lg font-bold">{formatCurrency(totalPaid, currency)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
            <p className="mt-6 text-xs text-slate-400">This statement reflects payments recorded in the system. It is not a fiscal receipt. Contact {org.name} for official receipts.</p>
          </>
        )}
      </div>

      {waterReadings.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Droplets className="h-5 w-5 text-cyan-500" /> Water Usage</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4">Unit</th>
                  <th className="pb-2 pr-4 text-right">Meter</th>
                  <th className="pb-2 pr-4 text-right">Used</th>
                  <th className="pb-2 pr-4 text-right">Rate</th>
                  <th className="pb-2 text-right">Charge</th>
                </tr>
              </thead>
              <tbody>
                {waterReadings.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2.5 pr-4 font-medium">{r.periodMonth}</td>
                    <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">{r.unit.property.name} · {r.unit.unitNumber}</td>
                    <td className="py-2.5 pr-4 text-right">{r.meterReading}</td>
                    <td className="py-2.5 pr-4 text-right">{r.unitsConsumed}</td>
                    <td className="py-2.5 pr-4 text-right">{formatCurrency(r.ratePerUnit, currency)}/unit</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(r.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
