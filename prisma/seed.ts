import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Safety guard: this seed wipes ALL data. Require explicit opt-in.
  const confirmed = process.env.SEED_CONFIRM === '1' || process.argv.includes('--force')
  if (!confirmed) {
    console.error('❌ Aborting: seed deletes ALL data. Re-run with SEED_CONFIRM=1 or --force to proceed.')
    process.exit(1)
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin'
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('⚠️  SEED_ADMIN_PASSWORD not set — using default "admin123" (dev only!)')
  }

  // Clean existing data
  await prisma.paymentSession.deleteMany()
  await prisma.maintenanceTicket.deleteMany()
  await prisma.rentPayment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.lease.deleteMany()
  await prisma.organizationMember.deleteMany()
  await prisma.unit.deleteMany()
  await prisma.property.deleteMany()
  await prisma.landlordPaymentGateway.deleteMany()
  await prisma.saaSSubscriptionLedger.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.subscriptionPlan.deleteMany()
  await prisma.user.deleteMany()

  // Create Super Admin
  const superAdminPassword = await bcrypt.hash(adminPassword, 10)
  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@ducksaas.com',
      username: adminUsername,
      passwordHash: superAdminPassword,
      globalRole: 'super_admin',
      phone: '+254700000000'
    }
  })
  console.log('✅ Created Super Admin')

  // Create Subscription Plans
  const starterPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Starter',
      priceMonthly: 29,
      priceYearly: 290,
      currency: 'USD',
      maxUnits: 10,
      featureFlags: {
        sms_reminders: false,
        water_submetering: false,
        expense_tracker: true,
        bulk_invoicing: false
      },
      isActive: true
    }
  })

  const proPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Pro',
      priceMonthly: 79,
      priceYearly: 790,
      currency: 'USD',
      maxUnits: 50,
      featureFlags: {
        sms_reminders: true,
        water_submetering: false,
        expense_tracker: true,
        bulk_invoicing: true
      },
      isActive: true
    }
  })

  await prisma.subscriptionPlan.create({
    data: {
      name: 'Enterprise',
      priceMonthly: 199,
      priceYearly: 1990,
      currency: 'USD',
      maxUnits: 999,
      featureFlags: {
        sms_reminders: true,
        water_submetering: true,
        expense_tracker: true,
        bulk_invoicing: true
      },
      isActive: true
    }
  })
  console.log('✅ Created Subscription Plans')

  // Create Landlord 1
  const landlord1Password = await bcrypt.hash('landlord123', 10)
  const landlord1 = await prisma.user.create({
    data: {
      name: 'John Kamau',
      email: 'john@landlord1.com',
      username: 'landlord1',
      passwordHash: landlord1Password,
      globalRole: 'standard',
      phone: '+254711111111'
    }
  })

  const org1 = await prisma.organization.create({
    data: {
      name: 'Kamau Properties',
      ownerUserId: landlord1.id,
      slug: 'kamau-properties',
      status: 'active',
      subscriptionPlanId: proPlan.id,
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  })

  await prisma.organizationMember.create({
    data: {
      organizationId: org1.id,
      userId: landlord1.id,
      role: 'landlord_admin'
    }
  })

  // Create SaaS subscription record
  await prisma.saaSSubscriptionLedger.create({
    data: {
      organizationId: org1.id,
      planId: proPlan.id,
      amount: 79,
      gateway: 'stripe',
      transactionRef: 'sub_123456',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  })

  // Create payment gateway for landlord 1
  await prisma.landlordPaymentGateway.create({
    data: {
      organizationId: org1.id,
      provider: 'mpesa_paybill',
      accountNumber: '123456',
      apiCredentialsEncrypted: {
        consumerKey: 'test_key',
        consumerSecret: 'test_secret',
        passkey: 'test_passkey',
        shortcode: '123456'
      },
      isActive: true
    }
  })

  // Create Property 1
  const property1 = await prisma.property.create({
    data: {
      organizationId: org1.id,
      name: 'Westlands Apartments',
      location: 'Westlands, Nairobi',
      type: 'Apartment',
      totalUnits: 12
    }
  })

  // Create Units for Property 1
  const units1 = []
  for (let i = 1; i <= 12; i++) {
    const unit = await prisma.unit.create({
      data: {
        organizationId: org1.id,
        propertyId: property1.id,
        unitNumber: `A${i.toString().padStart(2, '0')}`,
        floor: i <= 4 ? 1 : i <= 8 ? 2 : 3,
        monthlyRent: 25000 + (i * 1000),
        depositAmount: 50000,
        status: i <= 8 ? 'occupied' : 'vacant'
      }
    })
    units1.push(unit)
  }
  console.log('✅ Created Landlord 1 with properties and units')

  // Create Tenants for Landlord 1
  const tenant1Password = await bcrypt.hash('tenant123', 10)
  const tenant1 = await prisma.user.create({
    data: {
      name: 'Mary Wanjiku',
      email: 'mary@tenant.com',
      username: 'tenant1',
      passwordHash: tenant1Password,
      globalRole: 'standard',
      phone: '+254722222222'
    }
  })

  // Create lease for tenant 1
  const lease1 = await prisma.lease.create({
    data: {
      organizationId: org1.id,
      unitId: units1[0].id,
      tenantUserId: tenant1.id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      billingDayOfMonth: 1,
      status: 'active'
    }
  })

  // Add tenant as organization member
  await prisma.organizationMember.create({
    data: {
      organizationId: org1.id,
      userId: tenant1.id,
      role: 'tenant',
      unitId: units1[0].id
    }
  })

  // Create invoices for tenant 1
  const currentDate = new Date()
  for (let month = 0; month < 3; month++) {
    const invoiceDate = new Date(currentDate)
    invoiceDate.setMonth(currentDate.getMonth() - month)
    const billingMonth = `${invoiceDate.getFullYear()}-${(invoiceDate.getMonth() + 1).toString().padStart(2, '0')}`
    
    await prisma.invoice.create({
      data: {
        organizationId: org1.id,
        leaseId: lease1.id,
        unitId: units1[0].id,
        tenantUserId: tenant1.id,
        invoiceNumber: `INV-${billingMonth}-${tenant1.id.slice(-4).toUpperCase()}`,
        billingMonth,
        amountDue: units1[0].monthlyRent,
        amountPaid: month === 0 ? 0 : units1[0].monthlyRent,
        dueDate: new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 5),
        status: month === 0 ? 'unpaid' : 'paid'
      }
    })
  }

  // Create maintenance ticket
  await prisma.maintenanceTicket.create({
    data: {
      organizationId: org1.id,
      unitId: units1[0].id,
      tenantUserId: tenant1.id,
      category: 'plumbing',
      title: 'Leaking faucet',
      description: 'The bathroom faucet has been dripping for 2 days',
      photoUrls: [],
      priority: 'medium',
      status: 'open'
    }
  })
  console.log('✅ Created tenant data for Landlord 1')

  // Create Landlord 2
  const landlord2Password = await bcrypt.hash('landlord123', 10)
  const landlord2 = await prisma.user.create({
    data: {
      name: 'Sarah Ochieng',
      email: 'sarah@landlord2.com',
      username: 'landlord2',
      passwordHash: landlord2Password,
      globalRole: 'standard',
      phone: '+254733333333'
    }
  })

  const org2 = await prisma.organization.create({
    data: {
      name: 'Ochieng Estates',
      ownerUserId: landlord2.id,
      slug: 'ochieng-estates',
      status: 'active',
      subscriptionPlanId: starterPlan.id,
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  })

  await prisma.organizationMember.create({
    data: {
      organizationId: org2.id,
      userId: landlord2.id,
      role: 'landlord_admin'
    }
  })

  // Bank transfer gateway for landlord 2 so tenants can pay without M-Pesa creds
  await prisma.landlordPaymentGateway.create({
    data: {
      organizationId: org2.id,
      provider: 'bank_transfer',
      accountNumber: '0112345678',
      apiCredentialsEncrypted: {
        bankName: 'KCB Bank',
        accountName: 'Ochieng Estates'
      },
      isActive: true
    }
  })

  await prisma.saaSSubscriptionLedger.create({
    data: {
      organizationId: org2.id,
      planId: starterPlan.id,
      amount: 29,
      gateway: 'stripe',
      transactionRef: 'sub_789012',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  })

  // Create Property 2
  const property2 = await prisma.property.create({
    data: {
      organizationId: org2.id,
      name: 'Kilimani Court',
      location: 'Kilimani, Nairobi',
      type: 'Court',
      totalUnits: 8
    }
  })

  // Create Units for Property 2 — every occupied unit gets a real tenant + lease
  const units2 = []
  for (let i = 1; i <= 8; i++) {
    const unit = await prisma.unit.create({
      data: {
        organizationId: org2.id,
        propertyId: property2.id,
        unitNumber: `K${i.toString().padStart(2, '0')}`,
        floor: i <= 4 ? 1 : 2,
        monthlyRent: 35000 + (i * 1500),
        depositAmount: 70000,
        status: i <= 2 ? 'occupied' : 'vacant'
      }
    })
    units2.push(unit)
  }

  const demoTenants = [
    { name: 'Kevin Odhiambo', email: 'kevin@tenant2.com', username: 'tenant2', phone: '+254744444444' },
    { name: 'Aisha Mohammed', email: 'aisha@tenant2.com', username: 'tenant3', phone: '+254755555555' },
  ]
  const tenantPasswordHash = await bcrypt.hash('tenant123', 10)
  const leaseStart = new Date()
  leaseStart.setMonth(leaseStart.getMonth() - 1)
  const leaseEnd = new Date()
  leaseEnd.setFullYear(leaseEnd.getFullYear() + 1)
  for (let i = 0; i < demoTenants.length; i++) {
    const t = demoTenants[i]
    const tenantUser = await prisma.user.create({
      data: {
        name: t.name,
        email: t.email,
        username: t.username,
        passwordHash: tenantPasswordHash,
        globalRole: 'standard',
        phone: t.phone,
      }
    })
    await prisma.organizationMember.create({
      data: { organizationId: org2.id, userId: tenantUser.id, role: 'tenant', unitId: units2[i].id }
    })
    await prisma.lease.create({
      data: {
        organizationId: org2.id,
        unitId: units2[i].id,
        tenantUserId: tenantUser.id,
        startDate: leaseStart,
        endDate: leaseEnd,
        billingDayOfMonth: 1,
        status: 'active',
      }
    })
  }
  console.log('✅ Created Landlord 2 with properties, units, and tenants')

  console.log('🎉 Seed completed successfully!')
  console.log('\n📝 Test Credentials:')
  console.log(`Super Admin: admin@ducksaas.com / ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : 'admin123'}`)
  console.log('Landlord 1: john@landlord1.com / landlord123')
  console.log('Landlord 2: sarah@landlord2.com / landlord123')
  console.log('Tenant 1: mary@tenant.com / tenant123 (username tenant1)')
  console.log('Tenant 2: kevin@tenant2.com / tenant123 (username tenant2)')
  console.log('Tenant 3: aisha@tenant2.com / tenant123 (username tenant3)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
