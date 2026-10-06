import { tenantService } from './tenant.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class TenantController {
  list = asyncHandler(async (req, res) => {
    const tenants = await tenantService.listTenants(req.user);
    res.status(200).json(
      new ApiResponse(200, tenants, 'Tenants retrieved successfully')
    );
  });

  get = asyncHandler(async (req, res) => {
    const tenant = await tenantService.getTenant(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, tenant, 'Tenant retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    const tenant = await tenantService.createTenant(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, tenant, 'Tenant onboarded successfully')
    );
  });

  update = asyncHandler(async (req, res) => {
    const tenant = await tenantService.updateTenant(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, tenant, 'Tenant updated successfully')
    );
  });

  delete = asyncHandler(async (req, res) => {
    await tenantService.deleteTenant(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, null, 'Tenant deleted successfully')
    );
  });
}

export const tenantController = new TenantController();
