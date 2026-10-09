import { unitService } from './unit.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class UnitController {
  list = asyncHandler(async (req, res) => {
    const units = await unitService.listUnits(req.query, req.user);
    res.status(200).json(
      new ApiResponse(200, units, 'Units retrieved successfully')
    );
  });

  get = asyncHandler(async (req, res) => {
    const unit = await unitService.getUnit(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, unit, 'Unit retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    const unit = await unitService.createUnit(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, unit, 'Unit created successfully')
    );
  });

  update = asyncHandler(async (req, res) => {
    const unit = await unitService.updateUnit(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, unit, 'Unit updated successfully')
    );
  });

  delete = asyncHandler(async (req, res) => {
    await unitService.deleteUnit(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, null, 'Unit deleted successfully')
    );
  });
}

export const unitController = new UnitController();
