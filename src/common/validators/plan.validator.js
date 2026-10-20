import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Plan name must be at least 2 characters')
    .max(100, 'Plan name cannot exceed 100 characters'),
  slug: z.string().trim().optional(),
  description: z.string().trim().max(500).optional().nullable(),
  priceMonthly: z.coerce
    .number({ invalid_type_error: 'Monthly price must be a number' })
    .min(0, 'Monthly price cannot be negative'),
  priceYearly: z.coerce
    .number({ invalid_type_error: 'Yearly price must be a number' })
    .min(0, 'Yearly price cannot be negative'),
  maxProperties: z.coerce
    .number({ invalid_type_error: 'Max properties must be a number' })
    .int()
    .min(1, 'Max properties must be at least 1'),
  maxTenants: z.coerce
    .number({ invalid_type_error: 'Max tenants must be a number' })
    .int()
    .min(1, 'Max tenants must be at least 1'),
  maxStaff: z.coerce
    .number({ invalid_type_error: 'Max staff must be a number' })
    .int()
    .min(1, 'Max staff must be at least 1'),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const updatePlanSchema = createPlanSchema.partial();
