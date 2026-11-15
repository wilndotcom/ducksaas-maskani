-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('super_admin', 'standard');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'grace_period', 'suspended_readonly');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('landlord_admin', 'caretaker', 'tenant');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('Apartment', 'Court', 'Commercial');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('vacant', 'occupied', 'maintenance');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('active', 'terminated');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unpaid', 'partial', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('mpesa_stk', 'mpesa_c2b', 'card', 'cash_manual', 'bank_transfer');

-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('mpesa_paybill', 'mpesa_till', 'paystack_subaccount', 'bank_transfer');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('plumbing', 'electrical', 'structural', 'other');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "global_role" "GlobalRole" NOT NULL DEFAULT 'standard',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
    "subscription_plan_id" TEXT,
    "subscription_ends_at" TIMESTAMP(3),
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "unit_id" TEXT,
    "permissions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricing_model" TEXT NOT NULL DEFAULT 'flat',
    "price_monthly" DOUBLE PRECISION NOT NULL,
    "price_yearly" DOUBLE PRECISION NOT NULL,
    "price_per_property_monthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_per_property_yearly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "included_properties" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "max_units" INTEGER NOT NULL DEFAULT 10,
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscriptions_ledger" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "gateway" TEXT NOT NULL,
    "transaction_ref" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_subscriptions_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landlord_payment_gateways" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "account_number" TEXT NOT NULL,
    "api_credentials_encrypted" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landlord_payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "total_units" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "unit_number" TEXT NOT NULL,
    "floor" INTEGER,
    "monthly_rent" DOUBLE PRECISION NOT NULL,
    "deposit_amount" DOUBLE PRECISION NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'vacant',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "billing_day_of_month" INTEGER NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "billing_month" TEXT NOT NULL,
    "amount_due" DOUBLE PRECISION NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "gateway_reference" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "tenant_user_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'rent',
    "plan_id" TEXT,
    "billing_cycle" TEXT,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "checkout_request_id" TEXT,
    "reference" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "authorization_url" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photo_urls" JSONB,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'medium',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tenant_user_id" TEXT,
    "unit_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'medium',
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_owner_user_id_idx" ON "organizations"("owner_user_id");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_subscription_plan_id_idx" ON "organizations"("subscription_plan_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_unit_id_idx" ON "organization_members"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "subscription_plans_is_active_idx" ON "subscription_plans"("is_active");

-- CreateIndex
CREATE INDEX "subscription_plans_pricing_model_idx" ON "subscription_plans"("pricing_model");

-- CreateIndex
CREATE INDEX "saas_subscriptions_ledger_organization_id_idx" ON "saas_subscriptions_ledger"("organization_id");

-- CreateIndex
CREATE INDEX "saas_subscriptions_ledger_plan_id_idx" ON "saas_subscriptions_ledger"("plan_id");

-- CreateIndex
CREATE INDEX "saas_subscriptions_ledger_status_idx" ON "saas_subscriptions_ledger"("status");

-- CreateIndex
CREATE INDEX "landlord_payment_gateways_organization_id_idx" ON "landlord_payment_gateways"("organization_id");

-- CreateIndex
CREATE INDEX "landlord_payment_gateways_provider_idx" ON "landlord_payment_gateways"("provider");

-- CreateIndex
CREATE INDEX "properties_organization_id_idx" ON "properties"("organization_id");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "units_organization_id_idx" ON "units"("organization_id");

-- CreateIndex
CREATE INDEX "units_property_id_idx" ON "units"("property_id");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE UNIQUE INDEX "units_property_id_unit_number_key" ON "units"("property_id", "unit_number");

-- CreateIndex
CREATE INDEX "leases_organization_id_idx" ON "leases"("organization_id");

-- CreateIndex
CREATE INDEX "leases_unit_id_idx" ON "leases"("unit_id");

-- CreateIndex
CREATE INDEX "leases_tenant_user_id_idx" ON "leases"("tenant_user_id");

-- CreateIndex
CREATE INDEX "leases_status_idx" ON "leases"("status");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "invoices_lease_id_idx" ON "invoices"("lease_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_user_id_idx" ON "invoices"("tenant_user_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "rent_payments_organization_id_idx" ON "rent_payments"("organization_id");

-- CreateIndex
CREATE INDEX "rent_payments_invoice_id_idx" ON "rent_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "rent_payments_tenant_user_id_idx" ON "rent_payments"("tenant_user_id");

-- CreateIndex
CREATE INDEX "rent_payments_paid_at_idx" ON "rent_payments"("paid_at");

-- CreateIndex
CREATE INDEX "payment_sessions_organization_id_idx" ON "payment_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "payment_sessions_invoice_id_idx" ON "payment_sessions"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_sessions_kind_idx" ON "payment_sessions"("kind");

-- CreateIndex
CREATE INDEX "payment_sessions_checkout_request_id_idx" ON "payment_sessions"("checkout_request_id");

-- CreateIndex
CREATE INDEX "payment_sessions_reference_idx" ON "payment_sessions"("reference");

-- CreateIndex
CREATE INDEX "payment_sessions_status_idx" ON "payment_sessions"("status");

-- CreateIndex
CREATE INDEX "maintenance_tickets_organization_id_idx" ON "maintenance_tickets"("organization_id");

-- CreateIndex
CREATE INDEX "maintenance_tickets_unit_id_idx" ON "maintenance_tickets"("unit_id");

-- CreateIndex
CREATE INDEX "maintenance_tickets_tenant_user_id_idx" ON "maintenance_tickets"("tenant_user_id");

-- CreateIndex
CREATE INDEX "maintenance_tickets_status_idx" ON "maintenance_tickets"("status");

-- CreateIndex
CREATE INDEX "maintenance_tickets_priority_idx" ON "maintenance_tickets"("priority");

-- CreateIndex
CREATE INDEX "complaints_organization_id_idx" ON "complaints"("organization_id");

-- CreateIndex
CREATE INDEX "complaints_tenant_user_id_idx" ON "complaints"("tenant_user_id");

-- CreateIndex
CREATE INDEX "complaints_unit_id_idx" ON "complaints"("unit_id");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_priority_idx" ON "complaints"("priority");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_subscription_plan_id_fkey" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions_ledger" ADD CONSTRAINT "saas_subscriptions_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions_ledger" ADD CONSTRAINT "saas_subscriptions_ledger_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlord_payment_gateways" ADD CONSTRAINT "landlord_payment_gateways_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

