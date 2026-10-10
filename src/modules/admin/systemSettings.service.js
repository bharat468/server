import { prisma } from '../../config/database.config.js';
import { logger } from '../../common/logger/logger.js';

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

  async updateSetting(key, value) {
    await prisma.$executeRawUnsafe(
      `UPDATE "system_settings" SET "value" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = $2;`,
      String(value),
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
}

export const systemSettingsService = new SystemSettingsService();
