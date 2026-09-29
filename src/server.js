import { createApp } from './app.js';
import { env } from './config/env.config.js';
import { connectDatabase, disconnectDatabase } from './config/database.config.js';
import { logger } from './common/logger/logger.js';

const app = createApp();

let server;

async function bootstrap() {
  try {
    // 1. Establish database connection
    await connectDatabase();

    // 2. Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(`🚀 RENTMATE API server is running at http://localhost:${env.PORT}`);
      logger.info(`Active Environment: ${env.NODE_ENV}`);
    });

    // 3. Catch port errors (e.g. EADDRINUSE)
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(
          `❌ Port ${env.PORT} is already in use. Please stop the other process or change PORT in .env.`
        );
      } else {
        logger.error({ err: error }, '❌ Server failed with an unexpected error');
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to bootstrap application');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      logger.info('HTTP server and database connection closed successfully');
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