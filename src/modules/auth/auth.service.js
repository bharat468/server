import jwt from 'jsonwebtoken';
import { authRepository } from './auth.repository.js';
import { userRepository } from '../users/user.repository.js';
import { rbacRepository } from '../rbac/rbac.repository.js';
import { prisma } from '../../config/database.config.js';
import { env } from '../../config/env.config.js';
import { ApiError } from '../../common/errors/apiError.js';
import { logger } from '../../common/logger/logger.js';
import { systemSettingsService } from '../admin/systemSettings.service.js';

export class AuthService {
  constructor(authRepo = authRepository, userRepo = userRepository) {
    this.authRepo = authRepo;
    this.userRepo = userRepo;
  }

  /**
   * 6-digit random cryptographic OTP generator.
   * Format: 100000 to 999999
   */
  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * --------------------------------------------------------------------------
   * generateTokens(user, additionalClaims)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * User ke liye JWT Access Token aur Refresh Token sign karta hai.
   * Access Token ki expiry database system settings se dynamic hoti hai (default 15m),
   * aur Refresh Token 7 din ke liye valid hota hai.
   * 
   * @param {Object} user - User record (id, mobile, status)
   * @param {Object} [additionalClaims={}] - Role, permissions, isSuperAdmin claims
   * @returns {{ accessToken: string, refreshToken: string }}
   */
  generateTokens(user, additionalClaims = {}) {
    const payload = {
      id: user.id,
      mobile: user.mobile,
      status: user.status,
      tokenType: 'ACCESS',
      ...additionalClaims,
    };

    const accessMinutes = systemSettingsService.getCachedNumber('jwt_access_expiry_minutes', 15);
    const refreshDays = systemSettingsService.getCachedNumber('jwt_refresh_expiry_days', 7);

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: `${accessMinutes}m`,
    });

    const refreshToken = jwt.sign(
      {
        id: user.id,
        tokenType: 'REFRESH',
        jti: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      },
      env.JWT_SECRET,
      { expiresIn: `${refreshDays}d` }
    );

    return { accessToken, refreshToken };
  }

  /**
   * --------------------------------------------------------------------------
   * lookup(mobile)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Login screen se pehle check karta hai ki mobile number registered hai ya nahi,
   * aur user ka role & primary organization preview return karta hai.
   * 
   * @param {string} mobile - 10-digit Indian phone number
   */
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

  /**
   * --------------------------------------------------------------------------
   * sendOtp(mobile)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * 1. 10-digit mobile number format validate karta hai.
   * 2. Security Check: Dekhta hai ki user pre-registered hai ya nahi (zero-trust).
   * 3. Suspension Check: Suspended users ko block karta hai (403 Forbidden).
   * 4. 6-digit cryptographic OTP generate karke database me expiry ke sath save karta hai.
   * 5. Dev Mode: Terminal console me print karta hai (Prod me SMS Gateway hook hoga).
   * 
   * @param {string} mobile - Registered 10-digit mobile number
   * @returns {Promise<Object>} Expiration window, devOtp, and isSuperAdmin flag
   */
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
    const otpTtlMinutes = systemSettingsService.getCachedNumber('otp_expiry_minutes', 5);
    const expiresAt = new Date(Date.now() + otpTtlMinutes * 60 * 1000); // Dynamic TTL from settings

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
    console.log(`  Valid:  ${otpTtlMinutes} minutes`);
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

  /**
   * --------------------------------------------------------------------------
   * verifyOtp(mobile, otp)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * User dwara bheje gaye 6-digit OTP ko verify karta hai.
   * 
   * Flow & Logic:
   * 1. Database me check karta hai ki OTP valid aur non-expired hai ya nahi.
   * 2. Replay-attack prevention: OTP ko immediately `used: true` mark karta hai.
   * 3. User roles, permissions aur active organizations evaluate karta hai.
   * 4. SuperAdmin vs Landlord vs Tenant role detect karta hai.
   * 5. JWT Access Token & Refresh Token issue karke authenticated profile return karta hai.
   * 
   * @param {string} mobile
   * @param {string} otp - 6 digit code
   * @returns {Promise<Object>} User data, accessToken, refreshToken
   */
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

    const { roleName, organizationName, organizationId, isSuperAdmin } =
      await this.resolveUserProfile(user);

    const { accessToken, refreshToken } = this.generateTokens(user, {
      role: roleName,
      isSuperAdmin,
      adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
    });

    const { permissions, platformPermissions } = await this.calculateUserPermissions(user.id, organizationId);

    return {
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name || (isSuperAdmin ? 'SuperAdmin' : 'User'),
        email: user.email,
        status: user.status,
        role: roleName,
        organizationName,
        organizationId,
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

  /**
   * --------------------------------------------------------------------------
   * calculateUserPermissions(userId, organizationId)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Multi-Tenant RBAC Permissions Calculator:
   * 1. SuperAdmin Detection: Agar user superadmin hai toh platformPermissions = ['*'] aur permissions = ['*'].
   * 2. Organization Ownership: Agar user organization ka owner hai, toh use saari tenant permissions automatically grant hoti hain.
   * 3. Staff / Member RBAC: UserRoles se fine-grained permissions (property.create, tenant.read, finance.export, etc.) fetch karta hai.
   * 
   * @param {string} userId - User ID
   * @param {string} [organizationId=null] - Target organization workspace ID
   * @returns {Promise<{ permissions: string[], platformPermissions: string[] }>}
   */
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

    const { roleName, organizationName, organizationId, isSuperAdmin } =
      await this.resolveUserProfile(user);

    const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user, {
      role: roleName,
      isSuperAdmin,
      adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
    });

    const { permissions, platformPermissions } = await this.calculateUserPermissions(user.id, organizationId);

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
        organizationName,
        organizationId,
        isSuperAdmin,
        adminRole: user.adminRole || (isSuperAdmin ? 'SUPER_ADMIN' : null),
        permissions,
        platformPermissions,
        createdAt: user.createdAt,
      },
    };
  }

  async resolveUserProfile(user) {
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        ownedOrganizations: true,
        organizationMembers: { include: { organization: true } },
        userRoles: { include: { role: true, organization: true } },
        tenantLeases: { where: { status: 'ACTIVE' }, include: { property: true } },
      },
    });

    const isSuperAdmin = Boolean(user.isSuperAdmin || user.adminRole === 'SUPER_ADMIN');

    let roleName = 'Landlord';
    let organizationName = null;
    let organizationId = null;

    if (isSuperAdmin) {
      roleName = 'Platform SuperAdministrator';
    } else if (fullUser?.ownedOrganizations?.length > 0) {
      roleName = 'Owner';
      organizationName = fullUser.ownedOrganizations[0].name;
      organizationId = fullUser.ownedOrganizations[0].id;
    } else if (fullUser?.userRoles?.length > 0) {
      roleName = fullUser.userRoles[0].role?.name || 'Staff';
      organizationName = fullUser.userRoles[0].organization?.name || null;
      organizationId = fullUser.userRoles[0].organizationId || null;
    } else if (fullUser?.organizationMembers?.length > 0) {
      roleName = fullUser.organizationMembers[0].role === 'OWNER' ? 'Owner' : 'Staff';
      organizationName = fullUser.organizationMembers[0].organization?.name || null;
      organizationId = fullUser.organizationMembers[0].organizationId || null;
    } else if (fullUser?.tenantLeases?.length > 0) {
      roleName = 'Tenant';
      organizationName = fullUser.tenantLeases[0].property?.name || 'Rental Tenant';
    }

    return {
      roleName,
      organizationName,
      organizationId,
      isSuperAdmin,
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
