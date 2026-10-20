import { z } from 'zod';

export const createPropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Property title is required')
    .max(120, 'Property title cannot exceed 120 characters'),
  address: z
    .string()
    .trim()
    .min(1, 'Property address is required')
    .max(255, 'Property address cannot exceed 255 characters'),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City name cannot exceed 100 characters'),
  rent: z.coerce
    .number({ invalid_type_error: 'Valid rental amount greater than 0 is required' })
    .positive('Valid rental amount greater than 0 is required'),
  bedrooms: z.coerce
    .number({ invalid_type_error: 'Bedrooms must be a valid number' })
    .int('Bedrooms count must be a whole number')
    .min(0, 'Bedrooms count cannot be negative')
    .default(1),
  status: z.enum(['VACANT', 'OCCUPIED']).default('VACANT'),
  organizationId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});

export const updatePropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Property title is required')
    .max(120, 'Property title cannot exceed 120 characters')
    .optional(),
  address: z
    .string()
    .trim()
    .min(1, 'Property address is required')
    .max(255, 'Property address cannot exceed 255 characters')
    .optional(),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City name cannot exceed 100 characters')
    .optional(),
  rent: z.coerce
    .number({ invalid_type_error: 'Valid rental amount greater than 0 is required' })
    .positive('Valid rental amount greater than 0 is required')
    .optional(),
  bedrooms: z.coerce
    .number({ invalid_type_error: 'Bedrooms must be a valid number' })
    .int('Bedrooms count must be a whole number')
    .min(0, 'Bedrooms count cannot be negative')
    .optional(),
  status: z.enum(['VACANT', 'OCCUPIED']).optional(),
  organizationId: z.string().optional().nullable(),
});
