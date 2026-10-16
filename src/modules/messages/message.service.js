import { messageRepository } from './message.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { logger } from '../../common/logger/logger.js';

export class MessageService {
  constructor(repo = messageRepository) {
    this.repo = repo;
  }

  async submitMessage(payload, authUser = null) {
    const senderName = payload.name || payload.senderName || authUser?.name;
    const senderPhone = payload.mobile || payload.senderPhone || payload.phone || authUser?.mobile;
    const senderEmail = payload.email || payload.senderEmail || authUser?.email || null;
    const subject = payload.subject || 'Platform Support / Inquiry';
    const message = payload.message;
    const category = payload.category || (payload.units ? 'PORTFOLIO_INQUIRY' : 'GENERAL_INQUIRY');
    const priority = payload.priority || 'MEDIUM';

    if (!senderName || String(senderName).trim().length < 2) {
      throw new ApiError(400, 'Sender full name is required (at least 2 characters)');
    }

    if (!senderPhone || String(senderPhone).replace(/\D/g, '').length < 10) {
      throw new ApiError(400, 'A valid 10-digit mobile number is required');
    }

    if (!message || String(message).trim().length < 5) {
      throw new ApiError(400, 'Message body must be at least 5 characters long');
    }

    // Determine user role and organization details if logged in
    let userRole = 'VISITOR';
    let organizationId = null;
    let organizationName = null;

    if (authUser) {
      userRole = authUser.isSuperAdmin
        ? 'SUPER_ADMIN'
        : authUser.role || (authUser.organizationId ? 'LANDLORD' : 'USER');
      organizationId = authUser.organizationId || null;
      organizationName = authUser.organizationName || null;
    }

    const created = await this.repo.create({
      senderName,
      senderEmail,
      senderPhone: String(senderPhone).replace(/\D/g, '').slice(-10),
      userId: authUser?.id || null,
      userRole,
      organizationId,
      organizationName,
      subject,
      message,
      category,
      priority,
      status: 'UNREAD',
      replies: [],
    });

    logger.info(
      {
        messageId: created.id,
        sender: created.senderName,
        phone: created.senderPhone,
        role: userRole,
      },
      '[MessageService] New support message received for SuperAdmin'
    );

    return created;
  }

  async listMessages(filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));

    const result = await this.repo.listAll({
      status: filters.status,
      category: filters.category,
      search: filters.search,
      page,
      limit,
    });

    const unreadCount = await this.repo.countUnread();

    return {
      ...result,
      unreadCount,
    };
  }

  async getMessageById(id, markAsRead = false) {
    const msg = await this.repo.findById(id);
    if (!msg) {
      throw new ApiError(404, `Message with ID "${id}" was not found`);
    }

    if (markAsRead && msg.status === 'UNREAD') {
      return this.repo.updateStatus(id, 'READ');
    }

    return msg;
  }

  async replyToMessage(id, { replyMessage, markResolved = false }, adminUser) {
    if (!replyMessage || String(replyMessage).trim().length < 2) {
      throw new ApiError(400, 'Reply text is required');
    }

    const existing = await this.getMessageById(id);

    const updated = await this.repo.addReply(id, {
      senderId: adminUser?.id || null,
      senderName: adminUser?.name || 'Super Administrator',
      role: 'SUPER_ADMIN',
      message: replyMessage,
    });

    if (markResolved) {
      return this.repo.updateStatus(id, 'RESOLVED');
    }

    return updated;
  }

  async updateStatus(id, status) {
    const existing = await this.getMessageById(id);
    return this.repo.updateStatus(id, status);
  }

  async deleteMessage(id) {
    const existing = await this.getMessageById(id);
    return this.repo.delete(id);
  }

  async getMetrics() {
    const all = await this.repo.listAll({ limit: 5000 });
    const messages = all.messages || [];

    const total = messages.length;
    const unread = messages.filter((m) => m.status === 'UNREAD').length;
    const resolved = messages.filter((m) => m.status === 'RESOLVED').length;
    const inProgress = messages.filter((m) => m.status === 'IN_PROGRESS' || m.status === 'READ').length;

    // Today's count
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = messages.filter(
      (m) => new Date(m.createdAt).toISOString().slice(0, 10) === todayStr
    ).length;

    return {
      total,
      unread,
      resolved,
      inProgress,
      todayCount,
    };
  }

  async getMyMessages(authUser) {
    if (!authUser) {
      throw new ApiError(401, 'Authentication required to retrieve user messages');
    }
    return this.repo.listForUser(authUser.id, authUser.mobile);
  }
}

export const messageService = new MessageService();
