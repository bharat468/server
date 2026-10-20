import { ApiError } from '../errors/apiError.js';

export const validateRequest = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((e) => e.message);
    const primaryMessage = errorMessages[0] || 'Invalid input data';
    return next(new ApiError(400, primaryMessage, errorMessages));
  }
  req.body = result.data;
  next();
};

export const validateQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((e) => e.message);
    const primaryMessage = errorMessages[0] || 'Invalid query parameters';
    return next(new ApiError(400, primaryMessage, errorMessages));
  }
  req.query = result.data;
  next();
};

export const validateParams = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errorMessages = issues.map((e) => e.message);
    const primaryMessage = errorMessages[0] || 'Invalid URL parameters';
    return next(new ApiError(400, primaryMessage, errorMessages));
  }
  req.params = result.data;
  next();
};
