-- AlterTable: unit type and recurring extra charges
ALTER TABLE "units" ADD COLUMN "unit_type" TEXT;
ALTER TABLE "units" ADD COLUMN "extra_charges" JSONB;

-- AlterTable: invoice snapshot of non-rent recurring charges
ALTER TABLE "invoices" ADD COLUMN "other_charges" JSONB;
