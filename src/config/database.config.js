import { PrismaClient } from '@prisma/client';
import { logger } from '../common/logger/logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    await initSystemSettingsTable();
    logger.info('DB connected & system settings verified');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to the database');
    throw error;
  }
}

async function initSystemSettingsTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "key" TEXT NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'GENERAL',
        "description" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const defaultSettings = [
      { id: 'set-1', key: 'platform_name', value: 'RentMate Property Management', category: 'GENERAL', description: 'Commercial SaaS Brand Name' },
      { id: 'set-2', key: 'support_helpline', value: '+91 1800 123 4567', category: 'GENERAL', description: 'Customer Support Toll-Free Helpline' },
      { id: 'set-3', key: 'support_email', value: 'support@rentmate.in', category: 'GENERAL', description: 'Official Escalation Email' },
      { id: 'set-4', key: 'currency_symbol', value: '₹', category: 'BILLING', description: 'Default currency symbol' },
      { id: 'set-5', key: 'currency_code', value: 'INR', category: 'BILLING', description: 'ISO 4217 Currency Code' },
      { id: 'set-6', key: 'gst_rate_percent', value: '18', category: 'BILLING', description: 'Applicable GST / VAT tax rate (%)' },
      { id: 'set-7', key: 'subscription_grace_days', value: '7', category: 'BILLING', description: 'Grace period days before blocking expired subscriptions' },
      { id: 'set-8', key: 'trial_period_days', value: '14', category: 'BILLING', description: 'Free trial duration in days for new landlord accounts' },
      { id: 'set-9', key: 'maintenance_mode', value: 'false', category: 'SYSTEM', description: 'Temporary platform maintenance window mode' },
      { id: 'set-10', key: 'allow_self_signup', value: 'false', category: 'SECURITY', description: 'Whether public self-registration is allowed or invitation-only' },
    ];

    for (const s of defaultSettings) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "system_settings" ("id", "key", "value", "category", "description", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT ("key") DO NOTHING;`,
        s.id, s.key, s.value, s.category, s.description
      );
    }
  } catch (err) {
    logger.warn({ err }, 'System settings table check skipped or handled');
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected gracefully');
  } catch (error) {
    logger.error({ err: error }, 'Error while disconnecting from database');
  }
}
