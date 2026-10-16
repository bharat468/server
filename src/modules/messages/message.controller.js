import { messageService } from './message.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';

export class MessageController {
  constructor(service = messageService) {
    this.service = service;
  }

  submitMessage = async (req, res, next) => {
    try {
      const created = await this.service.submitMessage(req.body, req.user || null);
      return res.status(201).json(
        new ApiResponse(
          201,
          created,
          'Your message has been delivered to SuperAdmin. We will contact you shortly.'
        )
      );
    } catch (err) {
      next(err);
    }
  };

  listMessages = async (req, res, next) => {
    try {
      const data = await this.service.listMessages(req.query);
      return res.status(200).json(
        new ApiResponse(200, data, 'Messages fetched successfully', data.pagination)
      );
    } catch (err) {
      next(err);
    }
  };

  getMessage = async (req, res, next) => {
    try {
      const markAsRead = req.query.markRead !== 'false';
      const msg = await this.service.getMessageById(req.params.id, markAsRead);
      return res.status(200).json(
        new ApiResponse(200, msg, 'Message details retrieved')
      );
    } catch (err) {
      next(err);
    }
  };

  replyMessage = async (req, res, next) => {
    try {
      const updated = await this.service.replyToMessage(req.params.id, req.body, req.user);
      return res.status(200).json(
        new ApiResponse(200, updated, 'Reply sent to user message successfully')
      );
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const updated = await this.service.updateStatus(req.params.id, req.body.status);
      return res.status(200).json(
        new ApiResponse(200, updated, 'Message status updated')
      );
    } catch (err) {
      next(err);
    }
  };

  deleteMessage = async (req, res, next) => {
    try {
      await this.service.deleteMessage(req.params.id);
      return res.status(200).json(
        new ApiResponse(200, { id: req.params.id }, 'Message removed successfully')
      );
    } catch (err) {
      next(err);
    }
  };

  getMetrics = async (req, res, next) => {
    try {
      const metrics = await this.service.getMetrics();
      return res.status(200).json(
        new ApiResponse(200, metrics, 'Message hub metrics retrieved')
      );
    } catch (err) {
      next(err);
    }
  };

  getMyMessages = async (req, res, next) => {
    try {
      const list = await this.service.getMyMessages(req.user);
      return res.status(200).json(
        new ApiResponse(200, list, 'Your support inquiries retrieved')
      );
    } catch (err) {
      next(err);
    }
  };
}

export const messageController = new MessageController();
