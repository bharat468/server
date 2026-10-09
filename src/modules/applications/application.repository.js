import { prisma } from '../../config/database.config.js';

export class ApplicationRepository {
  async listForApplicant(applicantId) {
    return prisma.rentalApplication.findMany({
      where: { applicantId },
      include: {
        listing: {
          include: {
            unit: true,
            property: true,
          },
        },
        lease: {
          include: {
            rentRule: true,
            schedules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForOwner({ propertyId, status, where = {} } = {}) {
    const filter = { ...where };
    if (status && status !== 'ALL') filter.status = status;
    if (propertyId) {
      filter.listing = { propertyId };
    }

    return prisma.rentalApplication.findMany({
      where: filter,
      include: {
        listing: {
          include: {
            unit: true,
            property: true,
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        lease: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.rentalApplication.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            unit: true,
            property: true,
          },
        },
        applicant: true,
        lease: {
          include: {
            rentRule: true,
            schedules: true,
          },
        },
      },
    });
  }

  async create(data) {
    return prisma.rentalApplication.create({
      data,
      include: {
        listing: {
          include: {
            unit: true,
            property: true,
          },
        },
      },
    });
  }

  async update(id, data) {
    return prisma.rentalApplication.update({
      where: { id },
      data,
    });
  }

  // Atomic Transaction for Application Approval + Lease Activation + Rent Schedule
  async approveApplicationAndCreateLease({
    applicationId,
    leaseStartDate,
    leaseEndDate,
    rentRuleParams,
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Get Application with Listing and Unit
      const application = await tx.rentalApplication.findUnique({
        where: { id: applicationId },
        include: {
          listing: {
            include: { unit: true, property: true },
          },
          applicant: true,
        },
      });

      if (!application) {
        throw new Error('Rental application not found');
      }

      if (application.status !== 'PENDING') {
        throw new Error(`Application cannot be approved from ${application.status} status`);
      }

      const unit = application.listing.unit;
      if (unit.status === 'OCCUPIED') {
        throw new Error('This unit is already OCCUPIED by another active lease');
      }

      // 2. Mark application APPROVED
      const updatedApp = await tx.rentalApplication.update({
        where: { id: applicationId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });

      // 3. Create Lease
      const startDate = leaseStartDate ? new Date(leaseStartDate) : new Date();
      const endDate = leaseEndDate
        ? new Date(leaseEndDate)
        : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year default

      const lease = await tx.lease.create({
        data: {
          propertyId: application.listing.propertyId,
          unitId: unit.id,
          tenantId: application.applicantId,
          applicationId: application.id,
          startDate,
          endDate,
          monthlyRent: application.listing.monthlyRent,
          securityDeposit: application.listing.securityDeposit,
          depositStatus: 'PENDING',
          status: 'ACTIVE',
        },
      });

      // 4. Snapshot Rent Rules
      const rentRule = await tx.rentRule.create({
        data: {
          leaseId: lease.id,
          frequency: rentRuleParams?.frequency || 'MONTHLY',
          dueDay: rentRuleParams?.dueDay ? parseInt(rentRuleParams.dueDay, 10) : 5,
          graceDays: rentRuleParams?.graceDays ? parseInt(rentRuleParams.graceDays, 10) : 3,
          penaltyType: rentRuleParams?.penaltyType || 'PER_DAY',
          penaltyAmount: rentRuleParams?.penaltyAmount ? parseFloat(rentRuleParams.penaltyAmount) : 100,
          maxPenaltyCap: rentRuleParams?.maxPenaltyCap ? parseFloat(rentRuleParams.maxPenaltyCap) : 2000,
        },
      });

      // 5. Generate Initial Rent Schedules (First 3 months)
      const schedules = [];
      for (let i = 0; i < 3; i++) {
        const scheduleDate = new Date(startDate);
        scheduleDate.setMonth(scheduleDate.getMonth() + i);
        scheduleDate.setDate(rentRule.dueDay);

        const periodName = scheduleDate.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });

        const sched = await tx.rentSchedule.create({
          data: {
            leaseId: lease.id,
            period: periodName,
            dueDate: scheduleDate,
            amount: lease.monthlyRent,
            paidAmount: 0,
            penaltyAmount: 0,
            status: i === 0 ? 'DUE' : 'UPCOMING',
          },
        });
        schedules.push(sched);
      }

      // 6. Update Unit to OCCUPIED
      await tx.unit.update({
        where: { id: unit.id },
        data: { status: 'OCCUPIED' },
      });

      // 7. Update Listing to ARCHIVED
      await tx.rentalListing.update({
        where: { id: application.listingId },
        data: {
          status: 'ARCHIVED',
          isPublished: false,
        },
      });

      // 8. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: application.applicantId,
          action: 'LEASE_ACTIVATED',
          entityType: 'LEASE',
          entityId: lease.id,
          details: JSON.stringify({
            unitNumber: unit.unitNumber,
            propertyTitle: application.listing.property.title,
            monthlyRent: lease.monthlyRent,
          }),
        },
      });

      return {
        application: updatedApp,
        lease,
        rentRule,
        schedules,
      };
    });
  }
}

export const applicationRepository = new ApplicationRepository();
