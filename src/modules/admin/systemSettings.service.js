import { prisma } from '../../config/database.config.js';
import { logger } from '../../common/logger/logger.js';
import { ApiError } from '../../common/errors/apiError.js';

class SystemSettingsService {
  constructor() {
    this.cache = new Map();
    this.lastFetched = 0;
    this.cacheTtlMs = 30 * 1000; // 30 seconds cache TTL
  }

  async loadCache() {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "system_settings" ORDER BY "category" ASC, "key" ASC;`
      );
      this.cache.clear();
      for (const row of rows) {
        this.cache.set(row.key, row);
      }
      this.lastFetched = Date.now();
    } catch (err) {
      logger.warn({ err }, 'Failed to load system settings into cache');
    }
  }

  async ensureCacheFresh() {
    if (this.cache.size === 0 || Date.now() - this.lastFetched > this.cacheTtlMs) {
      await this.loadCache();
    }
  }

  getCachedString(key, defaultValue = '') {
    const entry = this.cache.get(key);
    if (!entry || entry.value === undefined || entry.value === null) {
      return defaultValue;
    }
    return String(entry.value);
  }

  getCachedNumber(key, defaultValue = 0) {
    const entry = this.cache.get(key);
    if (!entry || entry.value === undefined || entry.value === null) {
      return defaultValue;
    }
    const parsed = Number(entry.value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  getCachedBoolean(key, defaultValue = false) {
    const entry = this.cache.get(key);
    if (!entry || entry.value === undefined || entry.value === null) {
      return defaultValue;
    }
    return String(entry.value).toLowerCase() === 'true';
  }

  async getSetting(key, defaultValue = '') {
    await this.ensureCacheFresh();
    return this.getCachedString(key, defaultValue);
  }

  async getNumber(key, defaultValue = 0) {
    await this.ensureCacheFresh();
    return this.getCachedNumber(key, defaultValue);
  }

  async getBoolean(key, defaultValue = false) {
    await this.ensureCacheFresh();
    return this.getCachedBoolean(key, defaultValue);
  }

  async listSettings() {
    await this.ensureCacheFresh();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "system_settings" ORDER BY "category" ASC, "key" ASC;`
    );
    // Refresh cache with fresh database contents
    this.cache.clear();
    for (const row of rows) {
      this.cache.set(row.key, row);
    }
    this.lastFetched = Date.now();
    return rows;
  }

  async createSetting({ key, value, category = 'PLATFORM_GENERAL', description = '', unit = '', dataType = 'string' }) {
    const cleanKey = String(key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) {
      throw new ApiError(400, 'Setting variable key is required and must contain alphanumeric characters');
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT * FROM "system_settings" WHERE "key" = $1 LIMIT 1;`,
      cleanKey
    );
    if (existing && existing.length > 0) {
      throw new ApiError(409, `System setting variable '${cleanKey}' already exists`);
    }

    const id = `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "system_settings" ("id", "key", "value", "category", "description", "unit", "dataType", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP);`,
      id,
      cleanKey,
      String(value ?? ''),
      category,
      description,
      unit,
      dataType
    );

    const created = {
      id,
      key: cleanKey,
      value: String(value ?? ''),
      category,
      description,
      unit,
      dataType,
      updatedAt: new Date().toISOString(),
    };
    this.cache.set(cleanKey, created);
    return created;
  }

  async updateSetting(key, updates) {
    let val = updates;
    let desc = undefined;
    let unit = undefined;
    let cat = undefined;
    let dType = undefined;

    if (typeof updates === 'object' && updates !== null) {
      val = updates.value !== undefined ? String(updates.value) : undefined;
      desc = updates.description;
      unit = updates.unit;
      cat = updates.category;
      dType = updates.dataType;
    } else {
      val = String(updates);
    }

    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "system_settings" WHERE "key" = $1 LIMIT 1;`,
      key
    );
    if (!existingRows || existingRows.length === 0) {
      throw new ApiError(404, `System setting variable '${key}' not found`);
    }
    const current = existingRows[0];

    const finalVal = val !== undefined ? val : current.value;
    const finalDesc = desc !== undefined ? desc : current.description;
    const finalUnit = unit !== undefined ? unit : current.unit;
    const finalCat = cat !== undefined ? cat : current.category;
    const finalDType = dType !== undefined ? dType : current.dataType;

    await prisma.$executeRawUnsafe(
      `UPDATE "system_settings"
       SET "value" = $1, "description" = $2, "unit" = $3, "category" = $4, "dataType" = $5, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "key" = $6;`,
      finalVal,
      finalDesc,
      finalUnit,
      finalCat,
      finalDType,
      key
    );

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "system_settings" WHERE "key" = $1 LIMIT 1;`,
      key
    );
    const updated = rows[0];
    if (updated) {
      this.cache.set(key, updated);
      this.lastFetched = Date.now();
    }
    return updated;
  }

  async deleteSetting(key) {
    const PROTECTED_CORE_KEYS = new Set([
      'jwt_access_expiry_minutes',
      'jwt_refresh_expiry_days',
      'otp_expiry_minutes',
      'currency_code',
      'currency_symbol',
    ]);

    if (PROTECTED_CORE_KEYS.has(key)) {
      throw new ApiError(400, `Cannot delete core platform parameter '${key}' as it is vital to authentication or billing infrastructure`);
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT * FROM "system_settings" WHERE "key" = $1 LIMIT 1;`,
      key
    );
    if (!existing || existing.length === 0) {
      throw new ApiError(404, `System setting variable '${key}' not found`);
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "system_settings" WHERE "key" = $1;`,
      key
    );
    this.cache.delete(key);
    return { key, deleted: true };
  }
}

export const systemSettingsService = new SystemSettingsService();
