import { Router } from 'express';
import { ApiResponse } from '../../common/utils/apiResponse.js';

const router = Router();

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

export default router;
