import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  validateRequest,
} from '../../common/validators/auth.validator.js';

const router = Router();

// Public Authentication & Onboarding Endpoints
router.post('/lookup', authController.lookup);
router.post('/send-otp', validateRequest(sendOtpSchema), authController.sendOtp);
router.post('/verify-otp', validateRequest(verifyOtpSchema), authController.verifyOtp);
router.post('/refresh-token', authController.refreshToken);

// Protected Authentication Endpoints
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

export default router;
