import { Router } from 'express';
import { messageController } from './message.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireAdmin } from '../../common/guards/admin.guard.js';
import { authService } from '../auth/auth.service.js';
import { userRepository } from '../users/user.repository.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import {
  submitMessageSchema,
  replyMessageSchema,
  updateMessageStatusSchema,
} from '../../common/validators/message.validator.js';

const router = Router();

// Optional authentication helper: identifies user if token is present, but doesn't block guests
const optionalAuthenticate = async (req, _res, next) => {
  try {
    let token = req.cookies?.accessToken;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (token) {
      const decoded = authService.verifyJwt(token);
      if (decoded?.id && decoded.tokenType !== 'REFRESH') {
        const user = await userRepository.findById(decoded.id);
        if (user && user.status === 'ACTIVE') {
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Guest submission continues cleanly
  }
  next();
};

// ============================================================
// 1. PUBLIC / GENERAL USER INQUIRY SUBMISSION
// ============================================================
router.post('/', optionalAuthenticate, validateRequest(submitMessageSchema), messageController.submitMessage);

// ============================================================
// 2. USER SUPPORT HISTORY (My Messages)
// ============================================================
router.get('/my', authenticate, messageController.getMyMessages);

// ============================================================
// 3. SUPERADMIN INQUIRIES & MESSAGE DESK (Strictly Gated)
// ============================================================
router.get('/metrics', authenticate, requireAdmin, messageController.getMetrics);
router.get('/', authenticate, requireAdmin, messageController.listMessages);
router.get('/:id', authenticate, requireAdmin, messageController.getMessage);
router.post('/:id/reply', authenticate, requireAdmin, validateRequest(replyMessageSchema), messageController.replyMessage);
router.patch('/:id/status', authenticate, requireAdmin, validateRequest(updateMessageStatusSchema), messageController.updateStatus);
router.delete('/:id', authenticate, requireAdmin, messageController.deleteMessage);

export default router;
