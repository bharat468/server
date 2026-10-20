import { z } from 'zod';

export const createPaymentSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Payment amount must be greater than 0'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Billing month must be in YYYY-MM format'),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE']).default('PENDING'),
  propertyId: z.string().optional().nullable(),
  paidOn: z.string().optional().nullable(),
});

export const updatePaymentSchema = z.object({
  tenantId: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE']).optional(),
  propertyId: z.string().optional().nullable(),
  paidOn: z.string().optional().nullable(),
});
