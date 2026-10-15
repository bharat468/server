-- CreateTable: system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PLATFORM_GENERAL',
    "description" TEXT,
    "unit" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");

-- Insert Default Core System Settings Variables
INSERT INTO "system_settings" ("id", "key", "value", "category", "description", "unit", "dataType", "updatedAt")
VALUES
    ('set-jwt-access', 'jwt_access_expiry_minutes', '15', 'AUTH_SECURITY', 'Lifespan of platform JSON Web Access Tokens', 'minutes', 'number', CURRENT_TIMESTAMP),
    ('set-jwt-refresh', 'jwt_refresh_expiry_days', '7', 'AUTH_SECURITY', 'Lifespan of silent refresh rotation tokens', 'days', 'number', CURRENT_TIMESTAMP),
    ('set-otp-expiry', 'otp_expiry_minutes', '5', 'AUTH_SECURITY', 'Expiration duration for SMS login verification codes', 'minutes', 'number', CURRENT_TIMESTAMP),
    ('set-currency-code', 'currency_code', 'INR', 'BILLING_COMMERCE', 'Platform base operational currency code', 'ISO-4217', 'string', CURRENT_TIMESTAMP),
    ('set-currency-sym', 'currency_symbol', '₹', 'BILLING_COMMERCE', 'Standard currency symbol displayed across invoices', 'symbol', 'string', CURRENT_TIMESTAMP),
    ('set-tax-gst', 'tax_gst_percentage', '18', 'BILLING_COMMERCE', 'Applicable GST rate applied to subscriptions and invoices', '%', 'number', CURRENT_TIMESTAMP),
    ('set-maint-mode', 'platform_maintenance_mode', 'false', 'SYSTEM_OPS', 'Toggle public maintenance gateway lockdown', 'boolean', 'boolean', CURRENT_TIMESTAMP),
    ('set-max-upload', 'max_upload_size_mb', '10', 'SYSTEM_OPS', 'Maximum file upload payload size threshold', 'MB', 'number', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
