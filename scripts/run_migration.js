import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('--- Applying Meter Readings Migration ---');
  const sqlPath = path.join(
    __dirname,
    '../prisma/migrations/20261014071000_add_meter_readings_and_utility_rates/migration.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Execute the migration DDL
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "electricityRate" DOUBLE PRECISION NOT NULL DEFAULT 9.0;
  `);
  console.log('✔ electricityRate column verified in organizations');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "waterRate" DOUBLE PRECISION NOT NULL DEFAULT 20.0;
  `);
  console.log('✔ waterRate column verified in organizations');

  await prisma.$executeRawUnsafe(`
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
  `);
  console.log('✔ meter_readings table created/verified');

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meter_readings_unitId_fkey'
      ) THEN
        ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
  console.log('✔ foreign key constraint verified');

  console.log('Migration execution completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error running migration:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
