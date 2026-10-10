import { systemSettingsService } from '../../modules/admin/systemSettings.service.js';

export function maintenanceMiddleware(req, res, next) {
  const isMaintenance = systemSettingsService.getCachedBoolean('maintenance_mode', false);

  if (!isMaintenance) {
    return next();
  }

  // Exempt public status and auth endpoints so administrators can authenticate
  const path = req.path || '';
  if (
    path === '/' ||
    path.startsWith('/auth') ||
    path.startsWith('/admin') ||
    path.startsWith('/api/v1/auth') ||
    path.startsWith('/api/v1/admin')
  ) {
    return next();
  }

  // Exempt authenticated SuperAdmins
  if (req.user?.isSuperAdmin || req.user?.adminRole === 'SUPER_ADMIN') {
    return next();
  }

  return res.status(503).json({
    success: false,
    statusCode: 503,
    error: 'SERVICE_UNAVAILABLE',
    message: 'RentMate Platform is currently undergoing scheduled maintenance. Please check back shortly.',
    timestamp: new Date().toISOString(),
  });
}
