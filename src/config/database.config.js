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
        "category" TEXT NOT NULL DEFAULT 'PLATFORM_GENERAL',
        "description" TEXT,
        "unit" TEXT,
        "dataType" TEXT NOT NULL DEFAULT 'string',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure unit and dataType columns exist on older tables
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "unit" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "dataType" TEXT DEFAULT 'string';
    `);

    const defaultSettings = [
      // AUTH & SECURITY
      { id: 'set-jwt-access', key: 'jwt_access_expiry_minutes', value: '15', category: 'AUTH_SECURITY', dataType: 'number', unit: 'Minutes (m)', description: 'Access token validity period before silent rotation is required' },
      { id: 'set-jwt-refresh', key: 'jwt_refresh_expiry_days', value: '7', category: 'AUTH_SECURITY', dataType: 'number', unit: 'Days (d)', description: 'Secure HTTP-only refresh token session cookie lifespan' },
      { id: 'set-otp-ttl', key: 'otp_expiry_minutes', value: '5', category: 'AUTH_SECURITY', dataType: 'number', unit: 'Minutes (m)', description: 'One-Time Password (OTP) verification validity time window' },
      { id: 'set-max-attempts', key: 'max_login_attempts', value: '5', category: 'AUTH_SECURITY', dataType: 'number', unit: 'Attempts', description: 'Maximum consecutive failed OTP/login attempts before temporary lockout' },
      { id: 'set-signup', key: 'allow_self_signup', value: 'false', category: 'AUTH_SECURITY', dataType: 'boolean', unit: 'Toggle (true/false)', description: 'Allow public self-registration without administrator invitation' },

      // BILLING & COMMERCE
      { id: 'set-curr-sym', key: 'currency_symbol', value: '₹', category: 'BILLING_COMMERCE', dataType: 'string', unit: 'Currency Symbol', description: 'Currency symbol displayed across invoices, rent bills, and pricing plans' },
      { id: 'set-curr-code', key: 'currency_code', value: 'INR', category: 'BILLING_COMMERCE', dataType: 'string', unit: 'ISO 4217 Code', description: 'ISO standard three-letter currency code for payment transactions' },
      { id: 'set-gst', key: 'gst_rate_percent', value: '18', category: 'BILLING_COMMERCE', dataType: 'number', unit: 'Percentage (%)', description: 'Statutory GST / sales tax percentage applied to subscription plans' },
      { id: 'set-grace-days', key: 'subscription_grace_days', value: '7', category: 'BILLING_COMMERCE', dataType: 'number', unit: 'Days (d)', description: 'Grace period allowed after subscription expiry before feature access is restricted' },
      { id: 'set-trial-days', key: 'trial_period_days', value: '14', category: 'BILLING_COMMERCE', dataType: 'number', unit: 'Days (d)', description: 'Free trial duration in days assigned to newly onboarded landlord organizations' },

      // PLATFORM & BRANDING
      { id: 'set-name', key: 'platform_name', value: 'RentMate Property Management', category: 'PLATFORM_GENERAL', dataType: 'string', unit: 'Text / Brand', description: 'Commercial SaaS ecosystem brand name displayed on headers, PDFs, and notification messages' },
      { id: 'set-help', key: 'support_helpline', value: '+91 1800 123 4567', category: 'PLATFORM_GENERAL', dataType: 'string', unit: 'Phone / E.164', description: 'Official customer support toll-free helpline number' },
      { id: 'set-email', key: 'support_email', value: 'support@rentmate.in', category: 'PLATFORM_GENERAL', dataType: 'string', unit: 'Email Address', description: 'Primary escalation and customer grievance support email' },
      { id: 'set-web', key: 'company_website', value: 'https://rentmate.in', category: 'PLATFORM_GENERAL', dataType: 'string', unit: 'URL', description: 'Public marketing portal and product ecosystem website' },

      // SYSTEM & OPERATIONS
      { id: 'set-maint', key: 'maintenance_mode', value: 'false', category: 'SYSTEM_OPS', dataType: 'boolean', unit: 'Toggle (true/false)', description: 'Platform maintenance mode. When enabled, non-superadmins receive 503 Service Unavailable' },
      { id: 'set-audit', key: 'audit_logging_enabled', value: 'true', category: 'SYSTEM_OPS', dataType: 'boolean', unit: 'Toggle (true/false)', description: 'Record administrative mutations, role updates, and critical security actions in audit trail' },
      { id: 'set-notif', key: 'notification_email_alerts', value: 'true', category: 'SYSTEM_OPS', dataType: 'boolean', unit: 'Toggle (true/false)', description: 'Automated dispatch for rent overdue notices and payment receipts' },
    ];

    for (const s of defaultSettings) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "system_settings" ("id", "key", "value", "category", "description", "unit", "dataType", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT ("key") DO UPDATE SET
           "category" = EXCLUDED."category",
           "description" = EXCLUDED."description",
           "unit" = EXCLUDED."unit",
           "dataType" = EXCLUDED."dataType";`,
        s.id, s.key, s.value, s.category, s.description, s.unit, s.dataType
      );
    }
  } catch (err) {
    logger.warn({ err }, 'System settings table initialization handled');
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
