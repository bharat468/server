import { listingRepository } from './listing.repository.js';
import { unitRepository } from '../units/unit.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class ListingService {
  async listPublicListings(query) {
    return listingRepository.listPublic(query);
  }

  async getPublicListing(id) {
    const listing = await listingRepository.findById(id);
    if (!listing || !listing.isPublished) {
      throw new ApiError(404, 'Listing not found or is currently private');
    }
    return listing;
  }

  async listOwnerListings(query, user) {
    const scope = await getUserScope(user);

    const where = {};
    if (!scope.isSuperAdmin) {
      where.property = {
        OR: [
          { organizationId: { in: scope.orgIds } },
          { ownerId: user.id },
          { createdById: user.id },
        ],
      };
      if (scope.propertyScope.length > 0) {
        where.propertyId = { in: scope.propertyScope };
      }
    }

    return listingRepository.listOwner({
      propertyId: query.propertyId,
      where,
    });
  }

  async createListing(payload, user) {
    const unit = await unitRepository.findById(payload.unitId);
    if (!unit) {
      throw new ApiError(404, 'Target rentable unit not found');
    }

    const scope = await getUserScope(user);
    if (!scope.isSuperAdmin && unit.property) {
      const hasAccess =
        unit.property.ownerId === user.id ||
        unit.property.createdById === user.id ||
        scope.orgIds.includes(unit.property.organizationId);

      if (!hasAccess) {
        throw new ApiError(403, 'Access denied: You cannot list another landlord\'s unit');
      }
    }

    const listing = await listingRepository.create({
      unitId: payload.unitId,
      propertyId: unit.propertyId,
      title: payload.title || `${unit.type} - Unit ${unit.unitNumber}`,
      description: payload.description || '',
      category: payload.category || 'RESIDENTIAL',
      monthlyRent: parseFloat(payload.monthlyRent || unit.rentAmount),
      securityDeposit: parseFloat(payload.securityDeposit || unit.depositAmount),
      furnishing: payload.furnishing || unit.furnishing,
      availableFrom: payload.availableFrom ? new Date(payload.availableFrom) : new Date(),
      amenities: Array.isArray(payload.amenities) ? payload.amenities : [],
      photos: Array.isArray(payload.photos) ? payload.photos : [],
      isPublished: payload.isPublished !== undefined ? Boolean(payload.isPublished) : true,
      status: 'PUBLISHED',
    });

    // Update unit status to LISTED
    await unitRepository.update(unit.id, { status: 'LISTED' });

    return listing;
  }

  async updateListing(id, payload, user) {
    const listing = await listingRepository.findById(id);
    if (!listing) {
      throw new ApiError(404, 'Listing not found');
    }

    const scope = await getUserScope(user);
    if (!scope.isSuperAdmin && listing.property) {
      const hasAccess =
        listing.property.ownerId === user.id ||
        listing.property.createdById === user.id ||
        scope.orgIds.includes(listing.property.organizationId);

      if (!hasAccess) {
        throw new ApiError(403, 'Access denied: You cannot update this listing');
      }
    }

    const data = { ...payload };
    if (data.monthlyRent !== undefined) data.monthlyRent = parseFloat(data.monthlyRent);
    if (data.securityDeposit !== undefined) data.securityDeposit = parseFloat(data.securityDeposit);
    if (data.availableFrom) data.availableFrom = new Date(data.availableFrom);

    return listingRepository.update(id, data);
  }

  async deleteListing(id, user) {
    const listing = await listingRepository.findById(id);
    if (!listing) {
      throw new ApiError(404, 'Listing not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin && listing.property) {
        const hasAccess =
          listing.property.ownerId === user.id ||
          listing.property.createdById === user.id ||
          scope.orgIds.includes(listing.property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, 'Access denied: You cannot delete this listing');
        }
      }
    }

    await listingRepository.delete(id);
    // Return unit to VACANT if it was LISTED
    await unitRepository.update(listing.unitId, { status: 'VACANT' });
    return true;
  }
}

export const listingService = new ListingService();
