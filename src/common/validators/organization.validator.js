import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(120, 'Organization name cannot exceed 120 characters'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  ownerMobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number')
    .optional(),
  ownerName: z.string().trim().max(100).optional(),
  ownerEmail: z.string().trim().email('Invalid email address').optional().nullable(),
  planId: z.string().optional(),
});

export const addMemberSchema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  roleId: z.string().optional().nullable(),
  roleSlug: z.string().optional().nullable(),
  propertyScope: z.array(z.string()).default([]),
});

export const updateMemberSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  roleId: z.string().optional().nullable(),
  roleSlug: z.string().optional().nullable(),
  propertyScope: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const updateUtilityRatesSchema = z.object({
  electricityRate: z.coerce
    .number({ invalid_type_error: 'Electricity rate must be a number' })
    .min(0, 'Electricity rate cannot be negative'),
  waterRate: z.coerce
    .number({ invalid_type_error: 'Water rate must be a number' })
    .min(0, 'Water rate cannot be negative'),
});
