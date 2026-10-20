import { z } from 'zod';

export const createUnitSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitNumber: z
    .string()
    .trim()
    .min(1, 'Unit number is required')
    .max(50, 'Unit number cannot exceed 50 characters'),
  floor: z.coerce.number().int().default(1),
  type: z.string().default('FLAT_2BHK'),
  areaSqFt: z.coerce.number().positive().optional().nullable(),
  rentAmount: z.coerce
    .number({ invalid_type_error: 'Rent amount must be a number' })
    .positive('Rent amount must be greater than 0'),
  depositAmount: z.coerce
    .number({ invalid_type_error: 'Deposit amount must be a number' })
    .min(0, 'Deposit amount cannot be negative')
    .default(0),
  furnishing: z.string().default('SEMI_FURNISHED'),
  status: z.string().default('VACANT'),
});

export const updateUnitSchema = z.object({
  unitNumber: z.string().trim().min(1).max(50).optional(),
  floor: z.coerce.number().int().optional(),
  type: z.string().optional(),
  areaSqFt: z.coerce.number().positive().optional().nullable(),
  rentAmount: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  furnishing: z.string().optional(),
  status: z.string().optional(),
});

export const recordMeterReadingSchema = z.object({
  utilityType: z.enum(['ELECTRICITY', 'WATER']).default('ELECTRICITY'),
  currentReading: z.coerce
    .number({ invalid_type_error: 'Current reading must be a valid number' })
    .min(0, 'Current reading cannot be negative'),
  previousReading: z.coerce.number().min(0).optional(),
  customRate: z.coerce.number().positive('Custom rate must be greater than 0').optional(),
  readingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Reading month must be YYYY-MM').optional(),
  status: z.string().optional(),
  notes: z.string().max(500).optional().nullable(),
});
