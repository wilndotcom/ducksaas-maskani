-- AlterTable
ALTER TABLE "units" ADD COLUMN "water_rate_per_unit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "water_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "water_readings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "period_month" TEXT NOT NULL,
    "meter_reading" DOUBLE PRECISION NOT NULL,
    "previous_reading" DOUBLE PRECISION,
    "units_consumed" DOUBLE PRECISION NOT NULL,
    "rate_per_unit" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "water_readings_unitId_periodMonth_key" ON "water_readings"("unit_id", "period_month");
CREATE INDEX "water_readings_organization_id_idx" ON "water_readings"("organization_id");
CREATE INDEX "water_readings_unit_id_idx" ON "water_readings"("unit_id");
CREATE INDEX "water_readings_invoice_id_idx" ON "water_readings"("invoice_id");

-- AddForeignKey
ALTER TABLE "water_readings" ADD CONSTRAINT "water_readings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "water_readings" ADD CONSTRAINT "water_readings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "water_readings" ADD CONSTRAINT "water_readings_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
