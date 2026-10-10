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

    const isProd = process.env.NODE_ENV === 'production';
    const accessCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    };
    const refreshCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    // Store BOTH tokens in secure HTTP-only cookies
    res.cookie('accessToken', result.accessToken, accessCookieOptions);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    const message = result.isNewUser
      ? 'Welcome to RENTMATE! Your account has been registered.'
      : 'Authentication successful. Welcome back!';

    res.status(200).json(new ApiResponse(200, result, message));
  });

  refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await this.service.refreshAccessToken(token);

    const isProd = process.env.NODE_ENV === 'production';
    const accessCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    };
    const refreshCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    // Rotate BOTH accessToken and refreshToken cookies
    res.cookie('accessToken', result.accessToken, accessCookieOptions);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    res.status(200).json(
      new ApiResponse(200, result, 'Access token refreshed successfully')
    );
  });

  getMe = asyncHandler(async (req, res) => {
    const orgId = req.headers['x-organization-id'] || req.query.organizationId;
    const { permissions, platformPermissions } = await this.service.calculateUserPermissions(
      req.user.id,
      orgId
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          user: {
            id: req.user.id,
            mobile: req.user.mobile,
            name: req.user.name,
            email: req.user.email,
            status: req.user.status,
            isSuperAdmin: Boolean(req.user.isSuperAdmin),
            adminRole: req.user.adminRole,
            permissions,
            platformPermissions,
            createdAt: req.user.createdAt,
          },
        },
        'Profile retrieved successfully'
      )
    );
  });

  logout = asyncHandler(async (_req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const clearOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    };
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);
    res.status(200).json(
      new ApiResponse(200, null, 'Logged out successfully')
    );
  });
}

export const authController = new AuthController();
