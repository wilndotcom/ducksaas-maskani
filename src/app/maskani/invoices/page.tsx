import { resolveMaskaniOrg } from '@/lib/maskani'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getSavedCurrency } from '@/lib/currency'
import { InvoicesManager } from './invoices-manager'

export const instant = false

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgParam } = await searchParams
  const { org, roleLabel, orgQuery } = await resolveMaskaniOrg(orgParam)
  const cookieStore = await cookies()
  const currency = getSavedCurrency(cookieStore.get('ducksaas_currency')?.value)

  const [invoices, leases] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: org.id },
      include: {
        tenant: { select: { name: true, email: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
        lease: { select: { id: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lease.findMany({
      where: { organizationId: org.id, status: 'active' },
      include: { tenant: { select: { name: true } }, unit: { select: { unitNumber: true, monthlyRent: true, property: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <InvoicesManager
      organization={org}
      orgQuery={orgQuery}
      roleLabel={roleLabel}
      currency={currency}
      invoices={invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        billingMonth: i.billingMonth,
        amountDue: i.amountDue,
        amountPaid: i.amountPaid,
        dueDate: i.dueDate.toISOString().slice(0, 10),
        status: i.status as 'unpaid' | 'partial' | 'paid' | 'overdue',
        tenantName: i.tenant.name,
        tenantEmail: i.tenant.email,
        unitLabel: `${i.unit.property.name} - ${i.unit.unitNumber}`,
        payments: i.payments.map((p) => ({ id: p.id, amount: p.amount, method: p.paymentMethod, reference: p.gatewayReference, paidAt: p.paidAt.toISOString().slice(0, 10) })),
      }))}
      leases={leases.map((l) => ({ id: l.id, label: `${l.tenant.name} · ${l.unit.property.name} - ${l.unit.unitNumber}`, monthlyRent: l.unit.monthlyRent }))}
    />
  )
}
