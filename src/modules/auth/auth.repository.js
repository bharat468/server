import { prisma } from '../../config/database.config.js';

export class AuthRepository {
  async createOtp({ mobile, otp, expiresAt }) {
    // Invalidate any previous unused OTPs for this mobile
    await prisma.otp.updateMany({
      where: {
        mobile,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    return prisma.otp.create({
      data: {
        mobile,
        otp,
        expiresAt,
      },
    });
  }

  async findValidOtp(mobile, otp) {
    return prisma.otp.findFirst({
      where: {
        mobile,
        otp,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markOtpAsUsed(id) {
    return prisma.otp.update({
      where: { id },
      data: { isUsed: true },
    });
  }

  async incrementAttempts(id) {
    return prisma.otp.update({
      where: { id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }
}

export const authRepository = new AuthRepository();
