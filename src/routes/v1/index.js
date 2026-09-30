import { Router } from 'express';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import authRouter from '../../modules/auth/auth.routes.js';

const router = Router();

// Health Check Endpoint
router.get('/health', (_request, response) => {
  response.status(200).json(
    new ApiResponse(
      200,
      {
        status: 'ok',
        service: 'RENTMATE API',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      'RENTMATE API is running smoothly'
    )
  );
});

// Authentication Routes
router.use('/auth', authRouter);

export default router;
