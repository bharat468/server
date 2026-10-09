import { prisma } from '../../config/database.config.js';

export class ListingRepository {
  async listPublic({ search, category, city, minRent, maxRent, furnishing } = {}) {
    const where = {
      isPublished: true,
      status: 'PUBLISHED',
      unit: {
        status: { in: ['VACANT', 'LISTED'] },
      },
    };

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (furnishing && furnishing !== 'ALL') {
      where.furnishing = furnishing;
    }

    if (minRent || maxRent) {
      where.monthlyRent = {};
      if (minRent) where.monthlyRent.gte = parseFloat(minRent);
      if (maxRent) where.monthlyRent.lte = parseFloat(maxRent);
    }

    if (city) {
      where.property = {
        city: { contains: city, mode: 'insensitive' },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { property: { title: { contains: search, mode: 'insensitive' } } },
        { property: { city: { contains: search, mode: 'insensitive' } } },
        { property: { address: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return prisma.rentalListing.findMany({
      where,
      include: {
        unit: true,
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listOwner({ propertyId, where = {} } = {}) {
    const filter = { ...where };
    if (propertyId) filter.propertyId = propertyId;

    return prisma.rentalListing.findMany({
      where: filter,
      include: {
        unit: true,
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            organizationId: true,
            ownerId: true,
          },
        },
        applications: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.rentalListing.findUnique({
      where: { id },
      include: {
        unit: true,
        property: true,
        applications: {
          include: {
            applicant: {
              select: { id: true, name: true, mobile: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data) {
    return prisma.rentalListing.create({
      data,
      include: {
        unit: true,
        property: true,
      },
    });
  }

  async update(id, data) {
    return prisma.rentalListing.update({
      where: { id },
      data,
      include: {
        unit: true,
        property: true,
      },
    });
  }

  async delete(id) {
    return prisma.rentalListing.delete({
      where: { id },
    });
  }
}

export const listingRepository = new ListingRepository();
