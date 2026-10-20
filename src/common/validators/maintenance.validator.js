import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().optional().nullable(),
  title: z
    .string()
    .trim()
    .min(1, 'Issue title is required')
    .max(150, 'Issue title cannot exceed 150 characters'),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().default('PLUMBING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  cost: z.coerce
    .number({ invalid_type_error: 'Cost must be a number' })
    .min(0, 'Cost cannot be negative')
    .optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const assignMaintenanceSchema = z.object({
  assignedToId: z.string().min(1, 'Assigned staff user ID is required'),
});
