import { createApp } from './app.js';
import { env } from './config/env.config.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));