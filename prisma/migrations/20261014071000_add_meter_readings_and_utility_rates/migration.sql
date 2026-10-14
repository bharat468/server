-- AlterTable: Add electricityRate and waterRate to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "electricityRate" DOUBLE PRECISION NOT NULL DEFAULT 9.0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "waterRate" DOUBLE PRECISION NOT NULL DEFAULT 20.0;

-- CreateTable: meter_readings
CREATE TABLE IF NOT EXISTS "meter_readings" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "utilityType" TEXT NOT NULL DEFAULT 'ELECTRICITY',
    "readingMonth" TEXT NOT NULL,
    "previousReading" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentReading" DOUBLE PRECISION NOT NULL,
    "consumedUnits" DOUBLE PRECISION NOT NULL,
    "ratePerUnit" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BILLED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meter_readings_unitId_fkey'
    ) THEN
        ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
