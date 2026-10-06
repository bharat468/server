import { authService } from './auth.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

export class AuthController {
  constructor(service = authService) {
    this.service = service;
  }

  lookup = asyncHandler(async (req, res) => {
    const { mobile } = req.body;
    const result = await this.service.lookup(mobile);
    res.status(200).json(
      new ApiResponse(200, result, 'User lookup completed successfully')
    );
  });

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

    // Set secure HTTP-only cookie for refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const message = result.isNewUser
      ? 'Welcome to RENTMATE! Your account has been registered.'
      : 'Authentication successful. Welcome back!';

    res.status(200).json(new ApiResponse(200, result, message));
  });

  refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await this.service.refreshAccessToken(token);

    // Rotate refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json(
      new ApiResponse(200, result, 'Access token refreshed successfully')
    );
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
    res.clearCookie('refreshToken');
    res.status(200).json(
      new ApiResponse(200, null, 'Logged out successfully')
    );
  });
}

export const authController = new AuthController();
