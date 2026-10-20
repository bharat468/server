import { z } from 'zod';

export const createListingSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  title: z
    .string()
    .trim()
    .min(3, 'Listing title must be at least 3 characters')
    .max(150, 'Listing title cannot exceed 150 characters'),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().default('RESIDENTIAL'),
  monthlyRent: z.coerce
    .number({ invalid_type_error: 'Monthly rent must be a number' })
    .positive('Monthly rent must be greater than 0'),
  securityDeposit: z.coerce
    .number({ invalid_type_error: 'Security deposit must be a number' })
    .min(0, 'Security deposit cannot be negative')
    .default(0),
  furnishing: z.string().default('SEMI_FURNISHED'),
  amenities: z.array(z.string()).default([]),
});

export const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().optional(),
  monthlyRent: z.coerce.number().positive().optional(),
  securityDeposit: z.coerce.number().min(0).optional(),
  furnishing: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  status: z.string().optional(),
});
