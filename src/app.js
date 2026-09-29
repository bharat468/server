import express from 'express';
import { configureApp } from './config/app.config.js';
import v1Router from './routes/v1/index.js';
import { notFoundHandler } from './common/middleware/notFound.middleware.js';
import { errorHandler } from './common/middleware/error.middleware.js';
import { ApiResponse } from './common/utils/apiResponse.js';

export function createApp() {
  const app = express();

  configureApp(app);

  app.get('/', (_request, response) => {
    response.status(200).json(
      new ApiResponse(
        200,
        { name: 'RENTMATE API', version: '1.0.0' },
        'Welcome to RENTMATE API Server'
      )
    );
  });

  app.use('/api/v1', v1Router);

  // 404 handler
  app.use(notFoundHandler);

  // Centralized Global Error Handler
  app.use(errorHandler);

  return app;
}