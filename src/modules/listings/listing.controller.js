import { listingService } from './listing.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class ListingController {
  listPublic = asyncHandler(async (req, res) => {
    const listings = await listingService.listPublicListings(req.query);
    res.status(200).json(
      new ApiResponse(200, listings, 'Public listings retrieved successfully')
    );
  });

  getPublic = asyncHandler(async (req, res) => {
    const listing = await listingService.getPublicListing(req.params.id);
    res.status(200).json(
      new ApiResponse(200, listing, 'Public listing details retrieved successfully')
    );
  });

  listOwner = asyncHandler(async (req, res) => {
    const listings = await listingService.listOwnerListings(req.query, req.user);
    res.status(200).json(
      new ApiResponse(200, listings, 'Owner listings retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    const listing = await listingService.createListing(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, listing, 'Rental listing published successfully')
    );
  });

  update = asyncHandler(async (req, res) => {
    const listing = await listingService.updateListing(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, listing, 'Rental listing updated successfully')
    );
  });

  delete = asyncHandler(async (req, res) => {
    await listingService.deleteListing(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, null, 'Rental listing deleted successfully')
    );
  });
}

export const listingController = new ListingController();
