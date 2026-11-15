import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyTelegram } from '@/lib/telegram'
import { sendInvoiceEmail, sendPaymentReminderEmail } from '@/lib/email'
import { notifyUser } from '@/lib/notifications'
import { orgBillingSettings } from '@/lib/org-settings'

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
      unit: { select: { id: true, unitNumber: true, monthlyRent: true, extraCharges: true, property: { select: { name: true } } } },
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
      id: true, invoiceNumber: true, amountDue: true, amountPaid: true, dueDate: true, lateFee: true,
      tenantUserId: true,
      tenant: { select: { name: true, email: true } },
      lease: { select: { unit: { select: { monthlyRent: true } } } },
      organization: { select: { id: true, name: true, settings: true, status: true } },
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
    const bs = orgBillingSettings(inv.organization.settings)
    // Apply a one-time late fee when the invoice first goes overdue
    if (bs.lateFeeEnabled && bs.lateFeeValue > 0 && inv.lateFee === 0 && inv.amountPaid < inv.amountDue - 0.01) {
      const daysLate = Math.max(1, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000))
      const fee = bs.lateFeeType === 'percent'
        ? Math.round(((inv.lease?.unit.monthlyRent || inv.amountDue) * bs.lateFeeValue) / 100 * 100) / 100
        : bs.lateFeeType === 'daily'
          ? Math.round(bs.lateFeeValue * Math.min(daysLate, 30) * 100) / 100
          : bs.lateFeeValue
      if (fee > 0) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { amountDue: inv.amountDue + fee, lateFee: fee },
        }).catch(() => {})
      }
    }
    await notifyUser(inv.tenantUserId, inv.organization.id, {
      type: 'invoice',
      title: `Invoice ${inv.invoiceNumber} is overdue`,
      body: `Please settle your balance of ${inv.amountDue.toLocaleString()} ${bs.currency} to avoid further action.`,
      link: '/portal/invoices',
    }).catch(() => {})
    if (inv.tenant.email) {
      sendPaymentReminderEmail({
        to: inv.tenant.email,
        tenantName: inv.tenant.name,
        organizationName: inv.organization.name,
        invoiceNumber: inv.invoiceNumber,
        amountDue: inv.amountDue,
        amountPaid: inv.amountPaid,
        currency: bs.currency,
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

      const bs = orgBillingSettings(lease.organization.settings)
      const prefix = bs.invoicePrefix
      const graceDays = bs.graceDays
      const rentAmount = lease.unit.monthlyRent
      // Recurring extra charges configured on the unit (internet, retainer, etc.)
      const unitCharges = Array.isArray(lease.unit.extraCharges)
        ? (lease.unit.extraCharges as { label?: unknown; amount?: unknown }[])
            .map((c) => ({ label: String(c?.label || '').slice(0, 60), amount: Number(c?.amount) || 0 }))
            .filter((c) => c.label && c.amount > 0)
        : []
      const otherChargesTotal = unitCharges.reduce((sum, c) => sum + c.amount, 0)

      // Billing months owed: every month from the later of lease start or
      // 12 months ago, through the current month (bounded by lease end),
      // where the billing day has arrived and no invoice exists yet.
      // This catches up invoices missed while the cron was not running.
      const nowIdx = now.getFullYear() * 12 + now.getMonth()
      const startIdx = lease.startDate.getFullYear() * 12 + lease.startDate.getMonth()
      const endIdx = lease.endDate.getFullYear() * 12 + lease.endDate.getMonth()

      for (let idx = Math.max(startIdx, nowIdx - 11); idx <= Math.min(nowIdx, endIdx); idx++) {
        // For the current month, only bill once the billing day has arrived
        if (idx === nowIdx && lease.billingDayOfMonth > today) continue

        const by = Math.floor(idx / 12)
        const bm = idx % 12
        const billingMonth = `${by}-${String(bm + 1).padStart(2, '0')}`

        const existing = await prisma.invoice.findFirst({
          where: { leaseId: lease.id, billingMonth },
          select: { id: true },
        })
        if (existing) {
          skipped++
          continue
        }

        const dueDate = new Date(by, bm, lease.billingDayOfMonth)
        dueDate.setDate(dueDate.getDate() + graceDays)

        // Roll unbilled water readings for this unit+month into the invoice.
        // Readings stamped to this lease (or legacy unstamped ones) belong to
        // this tenant; readings stamped to other leases are billed separately.
        const waterReadings = await prisma.waterReading.findMany({
          where: {
            unitId: lease.unitId,
            periodMonth: billingMonth,
            invoiceId: null,
            OR: [{ leaseId: lease.id }, { leaseId: null }],
          },
          select: { id: true, amount: true },
        })
        // Prorate rent for the lease's first month when it starts mid-month:
        // charge only the remaining days of that month.
        const isStartMonth = lease.startDate.getFullYear() === by && lease.startDate.getMonth() === bm
        const startDay = lease.startDate.getDate()
        let monthRent = rentAmount
        if (isStartMonth && startDay > 1) {
          const daysInMonth = new Date(by, bm + 1, 0).getDate()
          monthRent = Math.round(rentAmount * ((daysInMonth - startDay + 1) / daysInMonth) * 100) / 100
        }
        const waterAmount = waterReadings.reduce((sum, r) => sum + r.amount, 0)
        const amountDue = monthRent + waterAmount + otherChargesTotal
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
            otherCharges: unitCharges.length > 0 ? unitCharges : undefined,
            dueDate,
            status,
          },
        })
        if (waterReadings.length > 0) {
          await prisma.waterReading.updateMany({
            where: { id: { in: waterReadings.map((r) => r.id) } },
            data: { invoiceId: invoice.id },
          })
        }
        created++

        if (lease.tenant.email) {
          sendInvoiceEmail({
            to: lease.tenant.email,
            name: lease.tenant.name,
            orgName: lease.organization.name,
            invoiceNumber: invoice.invoiceNumber,
            amount: amountDue,
            currency: bs.currency,
            dueDate: dueDate.toLocaleDateString(),
          }).catch(() => {})
        }
        await notifyUser(lease.tenant.id, lease.organizationId, {
          type: 'invoice',
          title: `New invoice ${invoice.invoiceNumber}`,
          body: `${lease.organization.name} billed you ${amountDue.toLocaleString()} ${bs.currency} for ${billingMonth}.`,
          link: '/portal/invoices',
        }).catch(() => {})
      }
    } catch (e) {
      errors.push(`${lease.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Bill unbilled water readings stamped to leases that received no monthly
  // invoice this run (e.g. terminated leases). The water charge follows the
  // tenant who actually consumed it — a departed tenant gets their own
  // water-only invoice instead of the new tenant inheriting it.
  const orphanReadings = await prisma.waterReading.findMany({
    where: { periodMonth: billingMonth, invoiceId: null, lease: { status: 'terminated' } },
    include: {
      lease: {
        select: {
          id: true, billingDayOfMonth: true, tenantUserId: true, organizationId: true,
          tenant: { select: { name: true, email: true } },
          organization: { select: { name: true, settings: true, status: true } },
        },
      },
    },
  })
  for (const reading of orphanReadings) {
    try {
      const l = reading.lease
      if (!l || l.organization.status === 'suspended_readonly') continue
      const bs = orgBillingSettings(l.organization.settings)
      const prefix = bs.invoicePrefix
      const graceDays = bs.graceDays
      const dueDate = new Date(year, month, l.billingDayOfMonth)
      dueDate.setDate(dueDate.getDate() + graceDays)

      const existing = await prisma.invoice.findFirst({
        where: { leaseId: l.id, billingMonth },
        select: { id: true, amountDue: true, amountPaid: true, waterAmount: true, dueDate: true },
      })
      if (existing) {
        const newDue = existing.amountDue + reading.amount
        const newPaid = existing.amountPaid
        const status = newPaid >= newDue - 0.01 ? 'paid' : existing.dueDate < now ? 'overdue' : newPaid > 0 ? 'partial' : 'unpaid'
        await prisma.$transaction([
          prisma.invoice.update({ where: { id: existing.id }, data: { amountDue: newDue, waterAmount: existing.waterAmount + reading.amount, status } }),
          prisma.waterReading.update({ where: { id: reading.id }, data: { invoiceId: existing.id } }),
        ])
      } else {
        const invoice = await prisma.invoice.create({
          data: {
            organizationId: l.organizationId,
            leaseId: l.id,
            unitId: reading.unitId,
            tenantUserId: l.tenantUserId,
            invoiceNumber: `${prefix}-${billingMonth}-${l.id.slice(-6).toUpperCase()}`,
            billingMonth,
            amountDue: reading.amount,
            amountPaid: 0,
            waterAmount: reading.amount,
            dueDate,
            status: dueDate < now ? 'overdue' : 'unpaid',
          },
        })
        await prisma.waterReading.update({ where: { id: reading.id }, data: { invoiceId: invoice.id } })
        if (l.tenant.email) {
          sendInvoiceEmail({
            to: l.tenant.email,
            name: l.tenant.name,
            orgName: l.organization.name,
            invoiceNumber: invoice.invoiceNumber,
            amount: reading.amount,
            currency: bs.currency,
            dueDate: dueDate.toLocaleDateString(),
          }).catch(() => {})
        }
      }
      created++
    } catch (e) {
      errors.push(`water:${reading.id}: ${e instanceof Error ? e.message : String(e)}`)
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
