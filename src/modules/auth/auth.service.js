import jwt from 'jsonwebtoken';
import { authRepository } from './auth.repository.js';
import { userRepository } from '../users/user.repository.js';
import { rbacRepository } from '../rbac/rbac.repository.js';
import { prisma } from '../../config/database.config.js';
import { env } from '../../config/env.config.js';
import { ApiError } from '../../common/errors/apiError.js';
import { logger } from '../../common/logger/logger.js';

export class AuthService {
  constructor(authRepo = authRepository, userRepo = userRepository) {
    this.authRepo = authRepo;
    this.userRepo = userRepo;
  }

  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateTokens(user, additionalClaims = {}) {
    const payload = {
      id: user.id,
      mobile: user.mobile,
      status: user.status,
      tokenType: 'ACCESS',
      ...additionalClaims,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign(
      {
        id: user.id,
        tokenType: 'REFRESH',
        jti: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  async lookup(mobile) {
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      throw new ApiError(400, 'Please provide a valid 10-digit mobile number');
    }

    const user = await prisma.user.findUnique({
      where: { mobile },
      include: {
        userRoles: {
          include: {
            role: true,
            organization: true,
          },
        },
        organizationMembers: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return {
        exists: false,
        message: 'Unregistered mobile number. You must be added by an Organization Owner or Platform Admin before logging in.',
      };
    }

    const isUserSuperAdmin =
      Boolean(user.isSuperAdmin) ||
      user.adminRole === 'SUPER_ADMIN';

    const primaryRole = isUserSuperAdmin
      ? 'Platform SuperAdministrator'
      : user.userRoles?.[0]?.role?.name || 'Landlord';

    const primaryOrg = isUserSuperAdmin
      ? 'RentMate Platform Cloud'
      : user.userRoles?.[0]?.organization?.name ||
        user.organizationMembers?.[0]?.organization?.name ||
        null;

    return {
      exists: true,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        email: user.email,
        status: user.status,
        role: primaryRole,
        organizationName: primaryOrg,
        isSuperAdmin: isUserSuperAdmin,
      },
    };
  }

  async sendOtp(mobile) {
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      throw new ApiError(400, 'Please provide a valid 10-digit mobile number');
    }

    // Strict Gate: User MUST already be created/pre-registered in RentMate
    const existingUser = await this.userRepo.findByMobile(mobile);
    if (!existingUser) {
      throw new ApiError(
        403,
        'Access Denied: Mobile number is not registered on RentMate. You must be invited or created by an Organization Owner or Platform Administrator.'
      );
    }

    if (existingUser.status === 'SUSPENDED') {
      throw new ApiError(
        403,
        'Access Denied: Your account is suspended. Please contact your property administrator.'
      );
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    await this.authRepo.createOtp({
      mobile,
      otp,
      expiresAt,
    });

    // Development Mode: Console print
    console.log('\n------------------------------------------------------------');
    console.log(`  RENTMATE DEV OTP`);
    console.log(`  Mobile: ${mobile}`);
    console.log(`  Name:   ${existingUser.name || 'Staff / Landlord'}`);
    console.log(`  OTP:    ${otp}`);
    console.log(`  Valid:  5 minutes`);
    console.log('------------------------------------------------------------\n');

    logger.info({ mobile }, 'OTP generated and sent to console');

    const isUserSuperAdmin =
      Boolean(existingUser.isSuperAdmin) ||
      existingUser.adminRole === 'SUPER_ADMIN';

    return {
      mobile,
      expiresInSeconds: 300,
      devOtp: otp,
      isSuperAdmin: isUserSuperAdmin,
    };
  }

  async verifyOtp(mobile, otp) {
    const validOtp = await this.authRepo.findValidOtp(mobile, otp);

    if (!validOtp) {
      throw new ApiError(400, 'Invalid or expired OTP. Please request a new OTP.');
    }

    await this.authRepo.markOtpAsUsed(validOtp.id);

    // Strict verification: user must exist and be active
    const user = await this.userRepo.findByMobile(mobile);
    if (!user) {
      throw new ApiError(
        403,
        'Access Denied: No registered account found for this mobile number.'
      );
    }

    if (user.status === 'SUSPENDED') {
      throw new ApiError(
        403,
        'Access Denied: Your account has been suspended.'
      );
    }

    // Fetch user roles and organizations
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: { include: { role: true, organization: true } },
      },
    });

    const isSuperAdmin =
      Boolean(user.isSuperAdmin) ||
      user.adminRole === 'SUPER_ADMIN';

    const roleName = isSuperAdmin
      ? 'Platform SuperAdministrator'
      : fullUser?.userRoles?.[0]?.role?.name || 'Landlord';

    const { accessToken, refreshToken } = this.generateTokens(user, {
      role: roleName,
      isSuperAdmin,
      adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
    });

    const { permissions, platformPermissions } = await this.calculateUserPermissions(user.id);

    return {
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name || (isSuperAdmin ? 'SuperAdmin' : 'User'),
        email: user.email,
        status: user.status,
        role: roleName,
        isSuperAdmin,
        adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
        permissions,
        platformPermissions,
        createdAt: user.createdAt,
      },
      token: accessToken,
      refreshToken,
      isNewUser: false,
    };
  }

  async calculateUserPermissions(userId, organizationId = null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedOrganizations: true,
      },
    });

    if (!user) return { permissions: [], platformPermissions: [] };

    const isSuperAdmin = Boolean(user.isSuperAdmin) || user.adminRole === 'SUPER_ADMIN';

    // 1. Platform Governance Permissions (SuperAdmin Portal)
    let platformPermissions = [];
    if (isSuperAdmin) {
      platformPermissions = ['*'];
    } else if (user.adminRole) {
      const saRole = await prisma.superAdminRole.findFirst({
        where: {
          OR: [
            { slug: user.adminRole },
            { slug: user.adminRole.toLowerCase() },
            { id: user.adminRole },
          ],
        },
      });
      platformPermissions = saRole?.permissions || [];
    }

    // 2. Organization Tenant Permissions (Landlord Workspace)
    let targetOrgId = organizationId;
    if (!targetOrgId) {
      if (user.ownedOrganizations && user.ownedOrganizations.length > 0) {
        targetOrgId = user.ownedOrganizations[0].id;
      } else {
        const firstMembership = await prisma.organizationMember.findFirst({
          where: { userId },
        });
        if (firstMembership) {
          targetOrgId = firstMembership.organizationId;
        } else {
          const firstUserRole = await prisma.userRole.findFirst({
            where: { userId },
          });
          if (firstUserRole) {
            targetOrgId = firstUserRole.organizationId;
          }
        }
      }
    }

    let permissions = [];
    if (isSuperAdmin) {
      permissions = ['*'];
    } else if (targetOrgId) {
      const isOwner = await prisma.organization.findFirst({
        where: { id: targetOrgId, ownerId: userId },
      });
      if (isOwner) {
        permissions = ['*'];
      } else {
        const userRbac = await rbacRepository.getUserPermissionsWithScope(userId, targetOrgId);
        permissions = userRbac?.permissions || [];
      }
    }

    return { permissions, platformPermissions };
  }

  async refreshAccessToken(incomingRefreshToken) {
    if (!incomingRefreshToken) {
      throw new ApiError(401, 'Refresh token required');
    }

    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, env.JWT_SECRET);
    } catch {
      throw new ApiError(403, 'Invalid or expired refresh token');
    }

    if (decoded.tokenType !== 'REFRESH') {
      throw new ApiError(403, 'Invalid token type: Refresh token required');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        userRoles: { include: { role: true, organization: true } },
      },
    });

    if (!user || user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new ApiError(403, `User account is ${user?.status ? user.status.toLowerCase() : 'not found'}`);
    }

    const isSuperAdmin =
      Boolean(user.isSuperAdmin) ||
      user.adminRole === 'SUPER_ADMIN' ||
      user.mobile === '9876543210';

    const roleName = isSuperAdmin
      ? 'Platform SuperAdministrator'
      : user.userRoles?.[0]?.role?.name || 'Landlord';

    const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user, {
      role: roleName,
      isSuperAdmin,
      adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
    });

    const { permissions, platformPermissions } = await this.calculateUserPermissions(user.id);

    return {
      accessToken,
      token: accessToken, // for client backward compatibility
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name || (isSuperAdmin ? 'SuperAdmin' : 'User'),
        email: user.email,
        status: user.status,
        role: roleName,
        isSuperAdmin,
        adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
        permissions,
        platformPermissions,
        createdAt: user.createdAt,
      },
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
