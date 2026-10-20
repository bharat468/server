import { z } from 'zod';

export const submitMessageSchema = z.object({
  name: z.string().trim().max(100).optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  subject: z
    .string()
    .trim()
    .max(200, 'Subject cannot exceed 200 characters')
    .optional(),
  category: z.string().default('SUPPORT'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  message: z
    .string()
    .trim()
    .min(2, 'Message cannot be empty')
    .max(3000, 'Message cannot exceed 3000 characters'),
});

export const replyMessageSchema = z.object({
  replyMessage: z
    .string()
    .trim()
    .min(2, 'Reply text is required')
    .max(3000, 'Reply cannot exceed 3000 characters')
    .optional(),
  reply: z.string().trim().min(2).max(3000).optional(),
  markResolved: z.boolean().optional(),
}).refine((data) => Boolean(data.replyMessage || data.reply), {
  message: 'Reply text is required',
});

export const updateMessageStatusSchema = z.object({
  status: z.string().min(1, 'Status cannot be empty'),
});
