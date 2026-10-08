import { ApiError } from '../errors/apiError.js';

export const errorHandler = (err, _req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    // Intercept Prisma Database Errors gracefully
    if (error?.name === 'PrismaClientKnownRequestError' || error?.code?.startsWith?.('P')) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const fieldName = Array.isArray(target) ? target.join(', ') : target || 'field';
        error = new ApiError(
          409,
          `A record with this ${fieldName} already exists. Please choose a different ${fieldName}.`,
          [],
          err.stack
        );
      } else if (error.code === 'P2003') {
        error = new ApiError(
          400,
          'Referenced relationship or organization record was not found.',
          [],
          err.stack
        );
      } else if (error.code === 'P2025') {
        error = new ApiError(
          404,
          'The requested record does not exist or has already been deleted.',
          [],
          err.stack
        );
      } else {
        error = new ApiError(
          400,
          'Database operation could not be processed with the provided parameters.',
          [],
          err.stack
        );
      }
    } else if (error?.name === 'PrismaClientValidationError') {
      error = new ApiError(
        400,
        'Invalid data payload provided for database operation.',
        [],
        err.stack
      );
    } else {
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Internal Server Error';
      error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};
