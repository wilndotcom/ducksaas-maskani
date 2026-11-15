-- AlterTable
ALTER TABLE "leases" ADD COLUMN "deposit_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "leases" ADD COLUMN "deposit_status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "late_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rent_payments" ADD COLUMN "receipt_number" TEXT;
CREATE INDEX "rent_payments_receipt_number_idx" ON "rent_payments"("receipt_number");

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
