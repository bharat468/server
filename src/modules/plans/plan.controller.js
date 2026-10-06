import { planRepository } from './plan.repository.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiError } from '../../common/errors/apiError.js';

export class PlanController {
  list = asyncHandler(async (_req, res) => {
    const plans = await planRepository.list();
    res.status(200).json(
      new ApiResponse(200, plans, 'Plans retrieved successfully')
    );
  });

  get = asyncHandler(async (req, res) => {
    const plan = await planRepository.findById(req.params.id);
    if (!plan) {
      throw new ApiError(404, 'Plan not found');
    }
    res.status(200).json(
      new ApiResponse(200, plan, 'Plan retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    if (!req.body.name) {
      throw new ApiError(400, 'Plan name is required');
    }
    const plan = await planRepository.create(req.body);
    res.status(201).json(
      new ApiResponse(201, plan, 'Plan created successfully')
    );
  });

  update = asyncHandler(async (req, res) => {
    const plan = await planRepository.update(req.params.id, req.body);
    res.status(200).json(
      new ApiResponse(200, plan, 'Plan updated successfully')
    );
  });

  delete = asyncHandler(async (req, res) => {
    await planRepository.delete(req.params.id);
    res.status(200).json(
      new ApiResponse(200, null, 'Plan deleted successfully')
    );
  });
}

export const planController = new PlanController();
