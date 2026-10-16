import { prisma } from '../../config/database.config.js';
import { logger } from '../../common/logger/logger.js';
import crypto from 'crypto';

export class MessageRepository {
  constructor() {
    this.memoryStore = new Map();
  }

  async create(data) {
    const id = data.id || `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();
    const record = {
      id,
      senderName: String(data.senderName || 'Anonymous').trim(),
      senderEmail: data.senderEmail ? String(data.senderEmail).trim() : null,
      senderPhone: String(data.senderPhone || '').trim(),
      userId: data.userId || null,
      userRole: data.userRole || 'VISITOR',
      organizationId: data.organizationId || null,
      organizationName: data.organizationName || null,
      subject: String(data.subject || 'General Inquiry').trim(),
      message: String(data.message || '').trim(),
      category: data.category || 'GENERAL_INQUIRY',
      status: data.status || 'UNREAD',
      priority: data.priority || 'MEDIUM',
      replies: Array.isArray(data.replies) ? data.replies : [],
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory cache
    this.memoryStore.set(id, record);

    // Try to persist to PostgreSQL if table exists
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "support_messages" (
          "id", "senderName", "senderEmail", "senderPhone",
          "userId", "userRole", "organizationId", "organizationName",
          "subject", "message", "category", "status", "priority",
          "replies", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
        record.id,
        record.senderName,
        record.senderEmail,
        record.senderPhone,
        record.userId,
        record.userRole,
        record.organizationId,
        record.organizationName,
        record.subject,
        record.message,
        record.category,
        record.status,
        record.priority,
        JSON.stringify(record.replies),
        record.createdAt,
        record.updatedAt
      );
    } catch (err) {
      // In tests or if DB raw query fails, in-memory store keeps it alive
      logger.debug({ err: err.message }, 'Persisted message to memory fallback');
    }

    return { ...record };
  }

  async listAll({ status, category, search, page = 1, limit = 20 } = {}) {
    let items = [];

    // Try fetching from database first
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "support_messages" ORDER BY "createdAt" DESC;`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        items = rows.map((r) => ({
          ...r,
          replies: typeof r.replies === 'string' ? JSON.parse(r.replies || '[]') : r.replies || [],
        }));
      } else {
        items = Array.from(this.memoryStore.values());
      }
    } catch (err) {
      items = Array.from(this.memoryStore.values());
    }

    // Sort descending by date
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply filtering
    if (status && status !== 'ALL') {
      items = items.filter((m) => m.status.toUpperCase() === status.toUpperCase());
    }

    if (category && category !== 'ALL') {
      items = items.filter((m) => m.category.toUpperCase() === category.toUpperCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (m) =>
          m.senderName.toLowerCase().includes(q) ||
          (m.senderEmail && m.senderEmail.toLowerCase().includes(q)) ||
          m.senderPhone.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q) ||
          (m.organizationName && m.organizationName.toLowerCase().includes(q))
      );
    }

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);

    return {
      messages: paginated,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "support_messages" WHERE "id" = $1 LIMIT 1;`,
        id
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const r = rows[0];
        return {
          ...r,
          replies: typeof r.replies === 'string' ? JSON.parse(r.replies || '[]') : r.replies || [],
        };
      }
    } catch (err) {
      // Fallback to memory
    }

    return this.memoryStore.get(id) || null;
  }

  async updateStatus(id, status) {
    const validStatuses = ['UNREAD', 'READ', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'];
    const newStatus = validStatuses.includes(status.toUpperCase()) ? status.toUpperCase() : 'READ';
    const now = new Date();

    const inMemory = this.memoryStore.get(id);
    if (inMemory) {
      inMemory.status = newStatus;
      inMemory.updatedAt = now;
      this.memoryStore.set(id, inMemory);
    }

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "support_messages" SET "status" = $1, "updatedAt" = $2 WHERE "id" = $3;`,
        newStatus,
        now,
        id
      );
    } catch (err) {
      logger.debug({ err: err.message }, 'Updated status in memory fallback');
    }

    return this.findById(id);
  }

  async addReply(id, reply) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const replies = Array.isArray(existing.replies) ? [...existing.replies] : [];
    const replyItem = {
      id: `rep-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      senderId: reply.senderId || null,
      senderName: reply.senderName || 'Super Administrator',
      role: reply.role || 'SUPER_ADMIN',
      message: String(reply.message || '').trim(),
      createdAt: new Date(),
    };
    replies.push(replyItem);

    const now = new Date();
    const newStatus = existing.status === 'UNREAD' ? 'IN_PROGRESS' : existing.status;

    if (this.memoryStore.has(id)) {
      const inMemory = this.memoryStore.get(id);
      inMemory.replies = replies;
      inMemory.status = newStatus;
      inMemory.updatedAt = now;
      this.memoryStore.set(id, inMemory);
    }

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "support_messages" SET "replies" = $1, "status" = $2, "updatedAt" = $3 WHERE "id" = $4;`,
        JSON.stringify(replies),
        newStatus,
        now,
        id
      );
    } catch (err) {
      logger.debug({ err: err.message }, 'Added reply in memory fallback');
    }

    return this.findById(id);
  }

  async delete(id) {
    this.memoryStore.delete(id);
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "support_messages" WHERE "id" = $1;`,
        id
      );
    } catch (err) {
      logger.debug({ err: err.message }, 'Deleted message in memory fallback');
    }
    return true;
  }

  async countUnread() {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "support_messages" WHERE "status" = 'UNREAD';`
      );
      if (Array.isArray(rows) && rows[0]?.count !== undefined) {
        return Number(rows[0].count);
      }
    } catch (err) {
      // Fallback
    }

    let unread = 0;
    for (const msg of this.memoryStore.values()) {
      if (msg.status === 'UNREAD') unread++;
    }
    return unread;
  }

  async listForUser(userId, phone) {
    const all = await this.listAll({ limit: 100 });
    return all.messages.filter(
      (m) => (userId && m.userId === userId) || (phone && m.senderPhone === phone)
    );
  }
}

export const messageRepository = new MessageRepository();
