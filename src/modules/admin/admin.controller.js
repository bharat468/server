import { adminRepository } from './admin.repository.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiError } from '../../common/errors/apiError.js';

export class AdminController {
  listUsers = asyncHandler(async (_req, res) => {
    const users = await adminRepository.listUsers();
    res.status(200).json(
      new ApiResponse(200, users, 'Users retrieved successfully')
    );
  });

  createUser = asyncHandler(async (req, res) => {
    const { mobile, name, email, roleId, organizationId, propertyScope } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      throw new ApiError(400, 'Valid 10-digit mobile number is required');
    }

    const user = await adminRepository.createUser({
      mobile,
      name,
      email,
      roleId,
      organizationId,
      propertyScope,
    });

    res.status(201).json(
      new ApiResponse(201, user, 'User created and role assigned successfully')
    );
  });

  updateStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      throw new ApiError(400, 'Invalid status value');
    }

    const updated = await adminRepository.updateUserStatus(req.params.id, status);
    res.status(200).json(
      new ApiResponse(200, updated, 'User status updated successfully')
    );
  });

  updateUser = asyncHandler(async (req, res) => {
    const { name, email, mobile } = req.body;
    const updated = await adminRepository.updateUserDetails(req.params.id, { name, email, mobile });
    res.status(200).json(
      new ApiResponse(200, updated, 'User profile updated successfully')
    );
  });

  deleteUser = asyncHandler(async (req, res) => {
    await adminRepository.deleteUser(req.params.id);
    res.status(200).json(
      new ApiResponse(200, null, 'User deleted successfully')
    );
  });

  updateRole = asyncHandler(async (req, res) => {
    const { roleId, organizationId, propertyScope } = req.body;
    if (!roleId || !organizationId) {
      throw new ApiError(400, 'roleId and organizationId are required');
    }

    const updated = await adminRepository.updateUserRole({
      userId: req.params.id,
      roleId,
      organizationId,
      propertyScope,
    });

    res.status(200).json(
      new ApiResponse(200, updated, 'User role assignment updated')
    );
  });

  getOverview = asyncHandler(async (_req, res) => {
    const overview = await adminRepository.getPlatformOverview();
    res.status(200).json(
      new ApiResponse(200, overview, 'Platform overview statistics retrieved')
    );
  });

  // SuperAdmin RBAC Endpoints
  listSuperAdminRoles = asyncHandler(async (_req, res) => {
    const roles = await adminRepository.listSuperAdminRoles();
    res.status(200).json(
      new ApiResponse(200, roles, 'SuperAdmin platform roles retrieved')
    );
  });

  createSuperAdminRole = asyncHandler(async (req, res) => {
    const { name, slug, description, permissions } = req.body;
    if (!name) {
      throw new ApiError(400, 'Role name is required');
    }
    const role = await adminRepository.createSuperAdminRole({
      name,
      slug,
      description,
      permissions,
    });
    res.status(201).json(
      new ApiResponse(201, role, 'SuperAdmin role created successfully')
    );
  });

  updateSuperAdminRole = asyncHandler(async (req, res) => {
    const role = await adminRepository.updateSuperAdminRole(req.params.id, req.body);
    res.status(200).json(
      new ApiResponse(200, role, 'SuperAdmin role updated successfully')
    );
  });

  deleteSuperAdminRole = asyncHandler(async (req, res) => {
    await adminRepository.deleteSuperAdminRole(req.params.id);
    res.status(200).json(
      new ApiResponse(200, null, 'SuperAdmin role deleted successfully')
    );
  });

  assignAdminRole = asyncHandler(async (req, res) => {
    const { isSuperAdmin, adminRole } = req.body;
    const user = await adminRepository.assignAdminRole(req.params.id, {
      isSuperAdmin,
      adminRole,
    });
    res.status(200).json(
      new ApiResponse(200, user, 'User platform administrative privileges updated')
    );
  });

  // Organizations & Subscription Management
  listOrganizations = asyncHandler(async (_req, res) => {
    const orgs = await adminRepository.listOrganizationsWithSubscriptions();
    res.status(200).json(
      new ApiResponse(200, orgs, 'Platform organizations retrieved successfully')
    );
  });

  updateOrganizationSubscription = asyncHandler(async (req, res) => {
    const { planId, expiresAt, status } = req.body;
    const updated = await adminRepository.updateOrganizationSubscription(req.params.id, {
      planId,
      expiresAt,
      status,
    });
    res.status(200).json(
      new ApiResponse(200, updated, 'Organization subscription updated successfully')
    );
  });

  // Dynamic Platform Settings
  listSettings = asyncHandler(async (_req, res) => {
    const settings = await adminRepository.listSettings();
    res.status(200).json(
      new ApiResponse(200, settings, 'System settings retrieved successfully')
    );
  });

  updateSetting = asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const updated = await adminRepository.updateSetting(key, value);
    res.status(200).json(
      new ApiResponse(200, updated, 'Setting updated successfully')
    );
  });
}

export const adminController = new AdminController();
