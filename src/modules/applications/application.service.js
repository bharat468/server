import { applicationRepository } from './application.repository.js';
import { listingRepository } from '../listings/listing.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class ApplicationService {
  async submitApplication(payload, user) {
    const listing = await listingRepository.findById(payload.listingId);
    if (!listing || !listing.isPublished) {
      throw new ApiError(404, 'Rental listing not available for application');
    }

    if (listing.unit.status === 'OCCUPIED') {
      throw new ApiError(400, 'This unit is already occupied');
    }

    // Tenant applies
    return applicationRepository.create({
      listingId: payload.listingId,
      applicantId: user.id,
      name: payload.name || user.name || 'Anonymous Applicant',
      email: payload.email || user.email || null,
      phone: payload.phone || user.mobile,
      occupation: payload.occupation || null,
      message: payload.message || null,
      proposedMoveIn: payload.proposedMoveIn ? new Date(payload.proposedMoveIn) : new Date(),
      status: 'PENDING',
    });
  }

  async listMyApplications(user) {
    return applicationRepository.listForApplicant(user.id);
  }

  async listOwnerApplications(query, user) {
    const scope = await getUserScope(user);

    const where = {};
    if (!scope.isSuperAdmin) {
      where.listing = {
        property: {
          OR: [
            { organizationId: { in: scope.orgIds } },
            { ownerId: user.id },
            { createdById: user.id },
          ],
        },
      };
      if (scope.propertyScope.length > 0) {
        where.listing.propertyId = { in: scope.propertyScope };
      }
    }

    return applicationRepository.listForOwner({
      propertyId: query.propertyId,
      status: query.status,
      where,
    });
  }

  async approveApplication(id, payload, user) {
    const application = await applicationRepository.findById(id);
    if (!application) {
      throw new ApiError(404, 'Rental application not found');
    }

    const scope = await getUserScope(user);
    if (!scope.isSuperAdmin && application.listing.property) {
      const hasAccess =
        application.listing.property.ownerId === user.id ||
        application.listing.property.createdById === user.id ||
        scope.orgIds.includes(application.listing.property.organizationId);

      if (!hasAccess) {
        throw new ApiError(403, 'Access denied: You cannot approve applications for another owner\'s listing');
      }
    }

    try {
      return await applicationRepository.approveApplicationAndCreateLease({
        applicationId: id,
        leaseStartDate: payload.leaseStartDate,
        leaseEndDate: payload.leaseEndDate,
        rentRuleParams: payload.rentRule,
      });
    } catch (err) {
      throw new ApiError(400, err.message || 'Failed to approve application and activate lease');
    }
  }

  async rejectApplication(id, payload, user) {
    const application = await applicationRepository.findById(id);
    if (!application) {
      throw new ApiError(404, 'Rental application not found');
    }

    const scope = await getUserScope(user);
    if (!scope.isSuperAdmin && application.listing.property) {
      const hasAccess =
        application.listing.property.ownerId === user.id ||
        application.listing.property.createdById === user.id ||
        scope.orgIds.includes(application.listing.property.organizationId);

      if (!hasAccess) {
        throw new ApiError(403, 'Access denied');
      }
    }

    return applicationRepository.update(id, {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewerNotes: payload.notes || null,
    });
  }
}

export const applicationService = new ApplicationService();
