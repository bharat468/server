import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tenant full name must be at least 2 characters')
    .max(100, 'Tenant full name cannot exceed 100 characters'),
  email: z.string().trim().email('Please provide a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  propertyId: z.string().optional().nullable(),
  leaseStart: z.string().optional().nullable(),
  leaseEnd: z.string().optional().nullable(),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  propertyId: z.string().optional().nullable(),
  leaseStart: z.string().optional().nullable(),
  leaseEnd: z.string().optional().nullable(),
});
