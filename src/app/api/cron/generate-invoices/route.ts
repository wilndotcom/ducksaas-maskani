import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyTelegram } from '@/lib/telegram'
import { sendInvoiceEmail, sendPaymentReminderEmail } from '@/lib/email'

/**
 * Generates monthly rent invoices for active leases.
 * Run daily (e.g. Vercel Cron / system cron hitting this endpoint).
 * For each active lease whose billingDayOfMonth has been reached this month
 * and which has no invoice for the current billing month yet, an invoice is
 * created for the unit's monthly rent.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based
  const billingMonth = `${year}-${String(month + 1).padStart(2, '0')}`
  const today = now.getDate()

  const leases = await prisma.lease.findMany({
    where: { status: 'active' },
    include: {
      unit: { select: { id: true, unitNumber: true, monthlyRent: true, property: { select: { name: true } } } },
      organization: { select: { id: true, name: true, settings: true, status: true, subscriptionEndsAt: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  })

  // Flip unpaid invoices past their due date to overdue and send a one-time reminder.
  let overdueMarked = 0
  let remindersSent = 0
  const stale = await prisma.invoice.findMany({
    where: { status: 'unpaid', dueDate: { lt: now } },
    select: {
      id: true, invoiceNumber: true, amountDue: true, amountPaid: true, dueDate: true,
      tenantUserId: true,
      tenant: { select: { name: true, email: true } },
      organization: { select: { name: true, settings: true, status: true } },
    },
  })
  for (const inv of stale) {
    if (inv.organization.status === 'suspended_readonly') continue
    const updated = await prisma.invoice.updateMany({
      where: { id: inv.id, status: 'unpaid' },
      data: { status: 'overdue' },
    })
    if (updated.count === 0) continue
    overdueMarked++
    const s = (inv.organization.settings as Record<string, unknown>) || {}
    if (inv.tenant.email) {
      sendPaymentReminderEmail({
        to: inv.tenant.email,
        tenantName: inv.tenant.name,
        organizationName: inv.organization.name,
        invoiceNumber: inv.invoiceNumber,
        amountDue: inv.amountDue,
        amountPaid: inv.amountPaid,
        currency: String(s.currency || 'KES'),
        dueDate: inv.dueDate,
        portalUrl: `${(process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')}/portal/invoices`,
      }).catch(() => {})
      remindersSent++
    }
  }

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const lease of leases) {
    try {
      // Only bill once the billing day has arrived this month
      if (lease.billingDayOfMonth > today) {
        skipped++
        continue
      }
      // Skip orgs whose subscription is suspended
      if (lease.organization.status === 'suspended_readonly') {
        skipped++
        continue
      }
      // Do not bill leases that have already ended
      if (lease.endDate < now) {
        skipped++
        continue
      }

      const existing = await prisma.invoice.findFirst({
        where: { leaseId: lease.id, billingMonth },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }

      const s = (lease.organization.settings as Record<string, unknown>) || {}
      const prefix = String(s.invoice_prefix || 'INV').replace(/[^A-Za-z0-9-]/g, '').slice(0, 10) || 'INV'
      const graceDays = Number.isFinite(Number(s.payment_grace_days)) ? Math.max(0, Math.min(60, Number(s.payment_grace_days))) : 0

      const dueDate = new Date(year, month, lease.billingDayOfMonth)
      dueDate.setDate(dueDate.getDate() + graceDays)

      // Roll any unbilled water reading for this unit+month into the invoice
      const waterReading = await prisma.waterReading.findFirst({
        where: { unitId: lease.unitId, periodMonth: billingMonth, invoiceId: null },
      })
      const rentAmount = lease.unit.monthlyRent
      const waterAmount = waterReading ? waterReading.amount : 0
      const amountDue = rentAmount + waterAmount
      if (!Number.isFinite(amountDue) || amountDue <= 0) {
        skipped++
        continue
      }

      const invoiceNumber = `${prefix}-${billingMonth}-${lease.id.slice(-6).toUpperCase()}`
      const status = dueDate < now ? 'overdue' : 'unpaid'

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          unitId: lease.unitId,
          tenantUserId: lease.tenantUserId,
          invoiceNumber,
          billingMonth,
          amountDue,
          amountPaid: 0,
          waterAmount,
          dueDate,
          status,
        },
      })
      if (waterReading) {
        await prisma.waterReading.update({ where: { id: waterReading.id }, data: { invoiceId: invoice.id } })
      }
      created++

      if (lease.tenant.email) {
        sendInvoiceEmail({
          to: lease.tenant.email,
          name: lease.tenant.name,
          orgName: lease.organization.name,
          invoiceNumber: invoice.invoiceNumber,
          amount: amountDue,
          currency: String(s.currency || 'KES'),
          dueDate: dueDate.toLocaleDateString(),
        }).catch(() => {})
      }
    } catch (e) {
      errors.push(`${lease.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (created > 0) {
    await notifyTelegram('Recurring invoices generated', {
      event: 'invoices_generated',
      billingMonth,
      created,
      skipped,
      errors: errors.length,
    })
  }

  return NextResponse.json({ ok: true, billingMonth, created, skipped, overdueMarked, remindersSent, errors })
}
