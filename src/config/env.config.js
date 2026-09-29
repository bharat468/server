import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:1234@localhost:5432/rentmate_dev?schema=public'),
});

export const env = envSchema.parse(process.env);
