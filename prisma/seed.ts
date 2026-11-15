import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clean existing data
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
  const superAdminPassword = await bcrypt.hash('admin123', 10)
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@ducksaas.com',
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

  const enterprisePlan = await prisma.subscriptionPlan.create({
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
        consumerSecret: 'test_secret'
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

  // Create Units for Property 2
  for (let i = 1; i <= 8; i++) {
    await prisma.unit.create({
      data: {
        organizationId: org2.id,
        propertyId: property2.id,
        unitNumber: `K${i.toString().padStart(2, '0')}`,
        floor: i <= 4 ? 1 : 2,
        monthlyRent: 35000 + (i * 1500),
        depositAmount: 70000,
        status: i <= 5 ? 'occupied' : 'vacant'
      }
    })
  }
  console.log('✅ Created Landlord 2 with properties and units')

  console.log('🎉 Seed completed successfully!')
  console.log('\n📝 Test Credentials:')
  console.log('Super Admin: admin@ducksaas.com / admin123')
  console.log('Landlord 1: john@landlord1.com / landlord123')
  console.log('Landlord 2: sarah@landlord2.com / landlord123')
  console.log('Tenant: mary@tenant.com / tenant123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
