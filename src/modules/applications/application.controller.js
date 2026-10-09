import { applicationService } from './application.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class ApplicationController {
  submit = asyncHandler(async (req, res) => {
    const application = await applicationService.submitApplication(req.body, req.user);
    res.status(201).json(
      new ApiResponse(201, application, 'Rental application submitted successfully')
    );
  });

  listMy = asyncHandler(async (req, res) => {
    const applications = await applicationService.listMyApplications(req.user);
    res.status(200).json(
      new ApiResponse(200, applications, 'My applications retrieved successfully')
    );
  });

  listOwner = asyncHandler(async (req, res) => {
    const applications = await applicationService.listOwnerApplications(req.query, req.user);
    res.status(200).json(
      new ApiResponse(200, applications, 'Received applications retrieved successfully')
    );
  });

  approve = asyncHandler(async (req, res) => {
    const result = await applicationService.approveApplication(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, result, 'Application approved and lease activated successfully!')
    );
  });

  reject = asyncHandler(async (req, res) => {
    const result = await applicationService.rejectApplication(req.params.id, req.body, req.user);
    res.status(200).json(
      new ApiResponse(200, result, 'Application rejected')
    );
  });
}

export const applicationController = new ApplicationController();
