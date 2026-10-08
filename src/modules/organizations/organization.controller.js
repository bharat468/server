import { organizationService } from './organization.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class OrganizationController {
  create = asyncHandler(async (req, res) => {
    const { name, slug } = req.body;
    const organization = await organizationService.createOrganization({
      name,
      slug,
      ownerId: req.user.id,
    });

    res.status(201).json(
      new ApiResponse(201, organization, 'Organization created successfully')
    );
  });

  list = asyncHandler(async (req, res) => {
    const organizations = await organizationService.getUserOrganizations(req.user.id);
    res.status(200).json(
      new ApiResponse(200, organizations, 'Organizations fetched successfully')
    );
  });

  getDetails = asyncHandler(async (req, res) => {
    const organizationId = req.params.organizationId || req.params.id;
    const organization = await organizationService.getOrganizationDetails(organizationId, req.user);
    res.status(200).json(
      new ApiResponse(200, organization, 'Organization details fetched successfully')
    );
  });

  listMembers = asyncHandler(async (req, res) => {
    const organizationId = req.params.organizationId || req.params.id;
    const members = await organizationService.listMembers(organizationId, req.user);
    res.status(200).json(
      new ApiResponse(200, members, 'Organization members fetched successfully')
    );
  });

  addMember = asyncHandler(async (req, res) => {
    const organizationId = req.params.organizationId || req.params.id;
    const { mobile, name, email, roleId, roleSlug, propertyScope } = req.body;

    const memberAssignment = await organizationService.addMember(
      {
        organizationId,
        mobile,
        name,
        email,
        roleId,
        roleSlug,
        propertyScope,
      },
      req.user
    );

    res.status(200).json(
      new ApiResponse(200, memberAssignment, 'Member added with role and scope successfully')
    );
  });

  removeMember = asyncHandler(async (req, res) => {
    const organizationId = req.params.organizationId || req.params.id;
    const { userId } = req.params;
    await organizationService.removeMember(organizationId, userId);
    res.status(200).json(
      new ApiResponse(200, null, 'Member removed from organization successfully')
    );
  });

  updateMember = asyncHandler(async (req, res) => {
    const organizationId = req.params.organizationId || req.params.id;
    const { userId } = req.params;
    const { roleId, propertyScope, status, name, email } = req.body;

    const members = await organizationService.updateMember({
      organizationId,
      userId,
      roleId,
      propertyScope,
      status,
      name,
      email,
    });

    res.status(200).json(
      new ApiResponse(200, members, 'Member updated successfully')
    );
  });

  createRole = asyncHandler(async (req, res) => {
    const organizationId = req.params.organizationId || req.params.id;
    const { name, slug, description, permissionKeys } = req.body;

    const role = await organizationService.createCustomRole({
      organizationId,
      name,
      slug,
      description,
      permissionKeys,
    });

    res.status(201).json(
      new ApiResponse(201, role, 'Custom role created successfully')
    );
  });
}

export const organizationController = new OrganizationController();
