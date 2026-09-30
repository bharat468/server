import { authService } from './auth.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class AuthController {
  constructor(service = authService) {
    this.service = service;
  }

  sendOtp = asyncHandler(async (req, res) => {
    const { mobile } = req.body;
    const result = await this.service.sendOtp(mobile);

    res.status(200).json(
      new ApiResponse(
        200,
        result,
        'OTP generated successfully. Check your terminal console for the development OTP.'
      )
    );
  });

  verifyOtp = asyncHandler(async (req, res) => {
    const { mobile, otp } = req.body;
    const result = await this.service.verifyOtp(mobile, otp);

    const message = result.isNewUser
      ? 'Welcome to RENTMATE! Your account has been registered.'
      : 'Authentication successful. Welcome back!';

    res.status(200).json(new ApiResponse(200, result, message));
  });

  getMe = asyncHandler(async (req, res) => {
    res.status(200).json(
      new ApiResponse(
        200,
        { user: req.user },
        'Profile retrieved successfully'
      )
    );
  });

  logout = asyncHandler(async (_req, res) => {
    res.status(200).json(
      new ApiResponse(200, null, 'Logged out successfully')
    );
  });
}

export const authController = new AuthController();
