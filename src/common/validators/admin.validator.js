import { z } from 'zod';

export const adminCreateUserSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  organizationId: z.string().optional().nullable(),
});

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  organizationId: z.string().optional().nullable(),
});

export const adminCreateRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(100),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(500).optional().nullable(),
  permissions: z.array(z.string()).min(1, 'Please select at least one permission'),
});

export const adminCreateSettingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, 'Setting key must be at least 2 characters')
    .regex(/^[a-z0-9_]+$/, 'Setting key must be lowercase letters, numbers, and underscores'),
  value: z.string().default(''),
  category: z.string().default('PLATFORM_GENERAL'),
  description: z.string().trim().max(500).optional().nullable(),
  unit: z.string().trim().max(50).optional().nullable(),
  dataType: z.enum(['string', 'number', 'boolean']).default('string'),
});
