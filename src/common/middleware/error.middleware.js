import { ApiError } from '../errors/apiError.js';

export const errorHandler = (err, _req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const errorMsg = String(error?.message || '');
    const isPrismaKnown =
      error?.name === 'PrismaClientKnownRequestError' ||
      error?.constructor?.name === 'PrismaClientKnownRequestError' ||
      (typeof error?.code === 'string' && error.code.startsWith('P'));

    const isPrismaUnique =
      error?.code === 'P2002' ||
      errorMsg.includes('Unique constraint failed');

    const isPrismaForeignKey =
      error?.code === 'P2003' ||
      errorMsg.includes('Foreign key constraint failed');

    const isPrismaNotFound =
      error?.code === 'P2025' ||
      errorMsg.includes('Record to update not found') ||
      errorMsg.includes('Record to delete does not exist') ||
      errorMsg.includes('does not exist');

    const isPrismaValidation =
      error?.name === 'PrismaClientValidationError' ||
      errorMsg.includes('PrismaClientValidationError') ||
      (errorMsg.includes('Invalid `prisma.') && errorMsg.includes('invocation:'));

    if (isPrismaUnique) {
      let fieldName = 'record';
      const target = error.meta?.target;
      if (Array.isArray(target)) {
        fieldName = target.join(', ');
      } else if (typeof target === 'string') {
        fieldName = target;
      } else {
        const match = errorMsg.match(/fields:\s*\(`?([^`\)]+)`?\)/i);
        if (match && match[1]) {
          fieldName = match[1].replace(/[`"']/g, '').trim();
        }
      }

      error = new ApiError(
        409,
        `A record with this ${fieldName} already exists. Please provide a different ${fieldName}.`,
        [],
        err.stack
      );
    } else if (isPrismaForeignKey) {
      error = new ApiError(
        400,
        'Referenced relationship or organization record was not found.',
        [],
        err.stack
      );
    } else if (isPrismaNotFound) {
      error = new ApiError(
        404,
        'The requested record does not exist or has already been deleted.',
        [],
        err.stack
      );
    } else if (isPrismaValidation || isPrismaKnown || errorMsg.includes('prisma.')) {
      error = new ApiError(
        400,
        'Invalid parameters provided for database operation.',
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
