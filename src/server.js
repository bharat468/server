import { createApp } from './app.js';
import { env } from './config/env.config.js';
import { connectDatabase, disconnectDatabase } from './config/database.config.js';
import { logger } from './common/logger/logger.js';

const app = createApp();

let server;

async function bootstrap() {
  try {
    await connectDatabase();

    server = app.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();