/**
 * Response Formatter Middleware
 * Intercepts res.json to guarantee production-standard API envelope consistency:
 * - Dynamic request path (req.originalUrl)
 * - HTTP status code
 * - HTTP method
 * - ISO timestamp
 */
export function responseFormatMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
      const statusCode = res.statusCode || body.statusCode || 200;
      const path = req.originalUrl || req.url;
      const method = req.method;
      const timestamp = body.timestamp || new Date().toISOString();

      // Ensure statusCode is synchronized
      body.statusCode = statusCode;

      // Dynamically attach request path and method if not already provided
      if (!body.path) {
        body.path = path;
      }
      if (!body.method) {
        body.method = method;
      }
      if (!body.timestamp) {
        body.timestamp = timestamp;
      }
    }

    return originalJson(body);
  };

  // Provide high-level response helper methods on res
  res.apiSuccess = function (data, message = 'Success', statusCode = 200, pagination = null) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      path: req.originalUrl || req.url,
      method: req.method,
      message,
      data,
      ...(pagination ? { pagination } : {}),
      timestamp: new Date().toISOString(),
    });
  };

  res.apiError = function (message = 'An error occurred', statusCode = 400, errors = []) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      path: req.originalUrl || req.url,
      method: req.method,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  };

  next();
}
