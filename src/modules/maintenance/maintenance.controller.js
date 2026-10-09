import { maintenanceService } from './maintenance.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class MaintenanceController {
  list = asyncHandler(async (req, res) => {
    const tickets = await maintenanceService.listTickets(req.query, req.user);
    res.status(200).json(
      new ApiResponse(200, tickets, 'Maintenance tickets retrieved successfully')
    );
  });

  listMy = asyncHandler(async (req, res) => {
    const tickets = await maintenanceService.listMyTenantTickets(req.user);
    res.status(200).json(
      new ApiResponse(200, tickets, 'Tenant maintenance tickets retrieved successfully')
    );
  });

  create = asyncHandler(async (req, res) => {
    const ticket = await maintenanceService.createTicket(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, ticket, 'Maintenance request created successfully')
    );
  });

  assign = asyncHandler(async (req, res) => {
    const ticket = await maintenanceService.assignStaff(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, ticket, 'Staff assigned to ticket successfully')
    );
  });

  updateStatus = asyncHandler(async (req, res) => {
    const ticket = await maintenanceService.updateStatus(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, ticket, 'Maintenance ticket status updated successfully')
    );
  });
}

export const maintenanceController = new MaintenanceController();
