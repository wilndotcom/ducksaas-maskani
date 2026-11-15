-- AlterTable: add lease_id to water_readings
ALTER TABLE "water_readings" ADD COLUMN "lease_id" TEXT;

-- AddForeignKey
ALTER TABLE "water_readings" ADD CONSTRAINT "water_readings_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old unique, add per-lease unique
ALTER TABLE "water_readings" DROP CONSTRAINT "water_readings_unit_id_period_month_key";
CREATE UNIQUE INDEX "water_readings_unit_id_period_month_lease_id_key" ON "water_readings"("unit_id", "period_month", "lease_id");

CREATE INDEX "water_readings_lease_id_idx" ON "water_readings"("lease_id");
