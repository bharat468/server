import { propertyService } from './property.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class PropertyController {
  list = asyncHandler(async (req, res) => {
    const properties = await propertyService.listProperties(req.query);
    res.status(200).json(
      new ApiResponse(200, properties, 'Properties retrieved successfully')
    );
  });

  get = asyncHandler(async (req, res) => {
    const property = await propertyService.getProperty(req.params.id);
    res.status(200).json(
      new ApiResponse(200, property, 'Property retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    const payload = {
      ...req.body,
      ownerId: req.user?.id || null,
    };
    const property = await propertyService.createProperty(payload);
    res.status(201).json(
      new ApiResponse(201, property, 'Property created successfully')
    );
  });

  update = asyncHandler(async (req, res) => {
    const property = await propertyService.updateProperty(req.params.id, req.body);
    res.status(200).json(
      new ApiResponse(200, property, 'Property updated successfully')
    );
  });

  delete = asyncHandler(async (req, res) => {
    await propertyService.deleteProperty(req.params.id);
    res.status(200).json(
      new ApiResponse(200, null, 'Property deleted successfully')
    );
  });
}

export const propertyController = new PropertyController();
