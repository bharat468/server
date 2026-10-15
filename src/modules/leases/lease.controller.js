import { leaseService } from './lease.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class LeaseController {
  listMyRentals = asyncHandler(async (req, res) => {
    const rentals = await leaseService.listMyRentals(req.user);
    res.status(200).json(
      new ApiResponse(200, rentals, 'My rented properties retrieved successfully')
    );
  });

  listOwner = asyncHandler(async (req, res) => {
    const leases = await leaseService.listOwnerLeases(req.query, req.user);
    res.status(200).json(
      new ApiResponse(200, leases, 'Active leases retrieved successfully')
    );
  });

  get = asyncHandler(async (req, res) => {
    const lease = await leaseService.getLease(req.params.id, req.user);
    res.status(200).json(
      new ApiResponse(200, lease, 'Lease details retrieved successfully')
    );
  });

  paySchedule = asyncHandler(async (req, res) => {
    const result = await leaseService.paySchedule(req.params.scheduleId, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, result, 'Rent payment recorded successfully')
    );
  });

  getExpiring = asyncHandler(async (req, res) => {
    const expiring = await leaseService.getExpiringLeases(req.user);
    res.status(200).json(
      new ApiResponse(200, expiring, 'Expiring leases retrieved successfully')
    );
  });

  renew = asyncHandler(async (req, res) => {
    const renewed = await leaseService.renewLease(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, renewed, 'Lease renewed successfully with escalation')
    );
  });

  terminate = asyncHandler(async (req, res) => {
    const terminated = await leaseService.terminateLease(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, terminated, 'Lease terminated successfully')
    );
  });
}

export const leaseController = new LeaseController();
