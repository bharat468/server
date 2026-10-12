import { applicationRepository } from './application.repository.js';
import { listingRepository } from '../listings/listing.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';
import { prisma } from '../../config/database.config.js';

export class ApplicationService {
  async submitApplication(payload, user) {
    let listing = null;

    if (payload.unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: payload.unitId },
        include: { property: true },
      });
      if (!unit) {
        throw new ApiError(404, 'Unit not found');
      }
      if (unit.status === 'OCCUPIED') {
        throw new ApiError(400, 'This unit is already occupied by an active lease');
      }

      // Check if active listing exists or create on the fly
      listing = await prisma.rentalListing.findFirst({
        where: { unitId: unit.id, status: { not: 'ARCHIVED' } },
        include: { unit: true, property: true },
      });

      if (!listing) {
        listing = await prisma.rentalListing.create({
          data: {
            unitId: unit.id,
            propertyId: unit.propertyId,
            title: `${unit.property.title} - Unit ${unit.unitNumber}`,
            description: `Unit ${unit.unitNumber} (${unit.type})`,
            category: 'RESIDENTIAL',
            monthlyRent: payload.monthlyRent ? parseFloat(payload.monthlyRent) : unit.rentAmount,
            securityDeposit: payload.securityDeposit ? parseFloat(payload.securityDeposit) : unit.depositAmount,
            furnishing: unit.furnishing,
            isPublished: true,
            status: 'PUBLISHED',
          },
          include: { unit: true, property: true },
        });
      }
    } else if (payload.listingId) {
      listing = await listingRepository.findById(payload.listingId);
      if (!listing) {
        throw new ApiError(404, 'Rental listing not available for application');
      }
      if (listing.unit?.status === 'OCCUPIED') {
        throw new ApiError(400, 'This unit is already occupied');
      }
    } else {
      throw new ApiError(400, 'Either unitId or listingId is required to submit an application');
    }

    // Determine applicant user
    const rawPhone = payload.phone || user.mobile;
    const phone = rawPhone ? String(rawPhone).replace(/\D/g, '').slice(0, 10) : '';

    let applicantId = user.id;
    if (phone && phone !== user.mobile) {
      let applicantUser = await prisma.user.findFirst({
        where: { mobile: phone },
      });
      if (!applicantUser) {
        applicantUser = await prisma.user.create({
          data: {
            mobile: phone,
            name: payload.name?.trim() || 'Prospective Tenant',
            email: payload.email?.trim() || null,
          },
        });
      }
      applicantId = applicantUser.id;
    }

    const application = await applicationRepository.create({
      listingId: listing.id,
      applicantId,
      name: payload.name || user.name || 'Anonymous Applicant',
      email: payload.email || user.email || null,
      phone: phone || user.mobile,
      occupation: payload.occupation || null,
      message: payload.message || null,
      proposedMoveIn: payload.proposedMoveIn ? new Date(payload.proposedMoveIn) : new Date(),
      status: 'PENDING',
    });

    // Update unit status to APPLICATION_PENDING if currently VACANT or LISTED
    if (listing.unit && (listing.unit.status === 'VACANT' || listing.unit.status === 'LISTED')) {
      await prisma.unit.update({
        where: { id: listing.unitId },
        data: { status: 'APPLICATION_PENDING' },
      });
    }

    return application;
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

    const rejected = await applicationRepository.update(id, {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewerNotes: payload.notes || null,
    });

    if (application.listing?.unitId) {
      const remainingPending = await prisma.rentalApplication.count({
        where: {
          listingId: application.listingId,
          status: 'PENDING',
          id: { not: id },
        },
      });
      if (remainingPending === 0) {
        await prisma.unit.update({
          where: { id: application.listing.unitId },
          data: { status: 'VACANT' },
        });
      }
    }

    return rejected;
  }
}

export const applicationService = new ApplicationService();
