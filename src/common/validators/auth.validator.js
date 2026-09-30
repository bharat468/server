import { z } from 'zod';
import { ApiError } from '../errors/apiError.js';

export const sendOtpSchema = z.object({
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
});

export const verifyOtpSchema = z.object({
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain numbers only'),
});

export const validateRequest = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((e) => e.message);
    const primaryMessage = errorMessages[0] || 'Invalid input data';
    return next(new ApiError(400, primaryMessage, errorMessages));
  }
  req.body = result.data;
  next();
};
