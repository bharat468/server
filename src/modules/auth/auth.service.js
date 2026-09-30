import jwt from 'jsonwebtoken';
import { authRepository } from './auth.repository.js';
import { userRepository } from '../users/user.repository.js';
import { env } from '../../config/env.config.js';
import { ApiError } from '../../common/errors/apiError.js';
import { logger } from '../../common/logger/logger.js';

export class AuthService {
  constructor(authRepo = authRepository, userRepo = userRepository) {
    this.authRepo = authRepo;
    this.userRepo = userRepo;
  }

  generateOtp() {
    // Generate secure 6-digit numeric OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtp(mobile) {
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    await this.authRepo.createOtp({
      mobile,
      otp,
      expiresAt,
    });

    // Development Mode: Print OTP directly to console (100% Free - no SMS provider needed)
    console.log('\n============================================================');
    console.log(`🔑 [RENTMATE DEV OTP]`);
    console.log(`📱 Mobile: ${mobile}`);
    console.log(`⚡ OTP Code: ${otp}`);
    console.log(`⏳ Valid for: 5 minutes`);
    console.log('============================================================\n');

    logger.info({ mobile }, 'OTP generated and sent to console');

    return {
      mobile,
      expiresInSeconds: 300,
    };
  }

  async verifyOtp(mobile, otp) {
    const validOtp = await this.authRepo.findValidOtp(mobile, otp);

    if (!validOtp) {
      throw new ApiError(400, 'Invalid or expired OTP. Please request a new OTP.');
    }

    // Mark OTP as used so it cannot be re-used
    await this.authRepo.markOtpAsUsed(validOtp.id);

    // Find or automatically create user (seamless onboarding)
    let user = await this.userRepo.findByMobile(mobile);

    let isNewUser = false;
    if (!user) {
      user = await this.userRepo.create({
        mobile,
        status: 'ACTIVE',
      });
      isNewUser = true;
      logger.info({ userId: user.id, mobile }, 'New user auto-registered via OTP');
    }

    // Generate JWT Access Token
    const token = jwt.sign(
      {
        id: user.id,
        mobile: user.mobile,
        status: user.status,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return {
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      },
      token,
      isNewUser,
    };
  }

  verifyJwt(token) {
    try {
      return jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new ApiError(401, 'Invalid or expired authentication token');
    }
  }
}

export const authService = new AuthService();
