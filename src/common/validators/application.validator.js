import { z } from 'zod';

export const submitApplicationSchema = z.object({
  listingId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  name: z
    .string()
    .trim()
    .min(1, 'Applicant name is required')
    .max(100, 'Applicant name cannot exceed 100 characters')
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number')
    .optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  occupation: z.string().trim().max(100).optional().nullable(),
  monthlyRent: z.coerce.number().positive().optional().nullable(),
  proposedMoveIn: z.string().optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
});

export const approveApplicationSchema = z
  .object({
    dueDay: z.coerce.number().int().min(1).max(28).optional(),
    graceDays: z.coerce.number().int().min(0).max(15).optional(),
    penaltyType: z.enum(['PER_DAY', 'PERCENTAGE', 'FIXED']).optional(),
    penaltyAmount: z.coerce.number().min(0).optional(),
    maxPenaltyCap: z.coerce.number().min(0).optional(),
    leaseStartDate: z.string().optional(),
    leaseEndDate: z.string().optional(),
    rentRule: z
      .object({
        dueDay: z.coerce.number().int().min(1).max(28).optional(),
        graceDays: z.coerce.number().int().min(0).max(15).optional(),
        penaltyType: z.enum(['PER_DAY', 'PERCENTAGE', 'FIXED']).optional(),
        penaltyAmount: z.coerce.number().min(0).optional(),
        maxPenaltyCap: z.coerce.number().min(0).optional(),
      })
      .optional(),
  })
  .passthrough();
