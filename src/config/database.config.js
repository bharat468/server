import { PrismaClient } from '@prisma/client';
import { logger } from '../common/logger/logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('DB connected');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to the database');
    throw error;
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected gracefully');
  } catch (error) {
    logger.error({ err: error }, 'Error while disconnecting from database');
  }
}
