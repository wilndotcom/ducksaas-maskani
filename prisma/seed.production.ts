import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

/**
 * Production seed — safe, idempotent, NON-DESTRUCTIVE.
 * Creates only what a fresh deployment needs:
 *   1. Super admin account (credentials from env — required)
 *   2. Subscription plans
 *   3. The master Maskani template org (gateway config is copied to new orgs)
 *
 * Does NOT create demo landlords/tenants and never deletes data.
 * Safe to re-run: everything is upserted by unique key.
 *
 * Required env:
 *   DATABASE_URL
 *   SEED_ADMIN_EMAIL     (default admin@ducksaas.com)
 *   SEED_ADMIN_USERNAME  (default admin)
 *   SEED_ADMIN_PASSWORD  (REQUIRED — no default in production)
 */
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding production baseline...')

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@ducksaas.com').toLowerCase()
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminPassword || adminPassword.length < 12) {
    console.error('SEED_ADMIN_PASSWORD is required and must be at least 12 characters.')
    process.exit(1)
  }

  // 1. Super admin
  const passwordHash = await bcrypt.hash(adminPassword, 10)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { globalRole: 'super_admin' },
    create: {
      name: 'Platform Admin',
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      globalRole: 'super_admin',
    },
  })
  console.log(`Super admin ready: ${adminUsername} / ${adminEmail}`)

  // 2. Subscription plans (upsert by name)
  const plans = [
    { name: 'Starter', priceMonthly: 29, priceYearly: 290, maxUnits: 10, featureFlags: { sms_reminders: false, water_submetering: false, expense_tracker: true, bulk_invoicing: false } },
    { name: 'Pro', priceMonthly: 79, priceYearly: 790, maxUnits: 50, featureFlags: { sms_reminders: true, water_submetering: false, expense_tracker: true, bulk_invoicing: true } },
    { name: 'Enterprise', priceMonthly: 199, priceYearly: 1990, maxUnits: 999, featureFlags: { sms_reminders: true, water_submetering: true, expense_tracker: true, bulk_invoicing: true } },
  ]
  for (const p of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({ where: { name: p.name } })
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: { ...p, isActive: true } })
    } else {
      await prisma.subscriptionPlan.create({ data: { ...p, currency: 'USD', isActive: true } })
    }
  }
  console.log(`Subscription plans ready: ${plans.map((p) => p.name).join(', ')}`)

  // 3. Master Maskani template org
  const masterSlug = process.env.MASKANI_MASTER_ORG_SLUG?.trim() || 'maskani-master'
  const masterOwnerEmail = 'maskani-master@internal.ducksaas'
  const masterOwner = await prisma.user.upsert({
    where: { email: masterOwnerEmail },
    update: {},
    create: {
      name: 'Maskani Master Template',
      email: masterOwnerEmail,
      // Unusable password — this account exists only to own the template org.
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      globalRole: 'standard',
    },
  })

  const masterOrg = await prisma.organization.upsert({
    where: { slug: masterSlug },
    update: {},
    create: {
      name: 'Maskani Master',
      ownerUserId: masterOwner.id,
      slug: masterSlug,
      status: 'active',
      subscriptionEndsAt: null, // template org never expires
    },
  })

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: masterOrg.id, userId: masterOwner.id } },
    update: { role: 'landlord_admin' },
    create: { organizationId: masterOrg.id, userId: masterOwner.id, role: 'landlord_admin' },
  })
  console.log(`Master Maskani org ready: ${masterOrg.name} (${masterOrg.slug})`)

  console.log('\nDone. Next steps:')
  console.log('- Configure payment gateways for the master org in DuckSaaS (they are copied to every new org)')
  console.log('- Set up the cron schedule for /api/cron/generate-invoices')
  console.log('- Register your first real landlord at /auth/register')
}

main()
  .catch((e) => {
    console.error('Production seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
