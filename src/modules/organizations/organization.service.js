import { organizationRepository } from './organization.repository.js';
import { rbacRepository } from '../rbac/rbac.repository.js';
import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../common/errors/apiError.js';

export class OrganizationService {
  async createOrganization({ name, slug, ownerId }) {
    const existing = await organizationRepository.findBySlug(slug);
    if (existing) {
      throw new ApiError(409, 'An organization with this slug already exists. Please choose a different slug.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          ownerId,
        },
      });

      // 2. Add owner as member
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: ownerId,
          role: 'OWNER',
        },
      });

      // 3. Find Owner system role
      const ownerRole = await tx.role.findFirst({
        where: { slug: 'owner', organizationId: null },
      });

      if (ownerRole) {
        await tx.userRole.create({
          data: {
            userId: ownerId,
            roleId: ownerRole.id,
            organizationId: org.id,
            propertyScope: [], // Global access to all properties
          },
        });
      }

      return org;
    });
  }

  async getUserOrganizations(userId) {
    return prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        _count: {
          select: { members: true },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrganizationDetails(organizationId) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }
    return org;
  }

  async listMembers(organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: {
            user: {
              include: {
                userRoles: {
                  where: { organizationId },
                  include: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!org) {
      throw new ApiError(404, 'Organization not found');
    }

    return org.members.map((m) => ({
      memberId: m.id,
      userId: m.user.id,
      name: m.user.name,
      mobile: m.user.mobile,
      email: m.user.email,
      status: m.user.status,
      role: m.user.userRoles?.[0]?.role?.name || m.role,
      roleSlug: m.user.userRoles?.[0]?.role?.slug || 'member',
      roleId: m.user.userRoles?.[0]?.role?.id,
      propertyScope: m.user.userRoles?.[0]?.propertyScope || [],
      joinedAt: m.createdAt,
    }));
  }

  async addMember({ organizationId, mobile, name, email, roleId, roleSlug = 'property-manager', propertyScope = [] }) {
    // 1. Find or auto-create user by mobile
    let user = await prisma.user.findUnique({
      where: { mobile },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          mobile,
          name: name || null,
          email: email || null,
          status: 'ACTIVE',
        },
      });
    } else if (name || email) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
        },
      });
    }

    // 2. Find role by ID or slug
    let role;
    if (roleId) {
      role = await prisma.role.findUnique({ where: { id: roleId } });
    } else {
      role = await rbacRepository.findRoleBySlug(roleSlug, organizationId);
    }

    if (!role) {
      throw new ApiError(404, `Role not found.`);
    }

    // 3. Add to OrganizationMember if not present
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      update: {
        role: role.name,
      },
      create: {
        organizationId,
        userId: user.id,
        role: role.name,
      },
    });

    // 4. Assign scoped UserRole
    return rbacRepository.assignRole({
      userId: user.id,
      roleId: role.id,
      organizationId,
      propertyScope,
    });
  }

  async removeMember(organizationId, userId) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new ApiError(404, 'Organization not found');
    if (org.ownerId === userId) {
      throw new ApiError(400, 'Cannot remove the primary organization owner');
    }

    await prisma.userRole.deleteMany({
      where: { userId, organizationId },
    });

    return prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
  }

  async createCustomRole({ organizationId, name, slug, description, permissionKeys }) {
    const existing = await rbacRepository.findRoleBySlug(slug, organizationId);
    if (existing) {
      throw new ApiError(409, `A role with slug '${slug}' already exists.`);
    }

    return rbacRepository.createRole({
      organizationId,
      name,
      slug,
      description,
      permissionKeys,
    });
  }
}

export const organizationService = new OrganizationService();
