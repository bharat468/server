import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../common/errors/apiError.js';

export class RbacRepository {
  async listPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });
  }

  async listRoles(organizationId = null) {
    return prisma.role.findMany({
      where: {
        OR: [
          { isSystem: true, organizationId: null },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findRoleById(roleId) {
    return prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async findRoleBySlug(slug, organizationId = null) {
    return prisma.role.findFirst({
      where: {
        slug,
        OR: [
          { organizationId: null },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
    });
  }

  async createRole({ organizationId, name, slug, description, permissionKeys = [] }) {
    const existing = await prisma.role.findFirst({
      where: {
        slug,
        organizationId: organizationId || null,
      },
    });
    if (existing) {
      throw new ApiError(409, `A role with identifier '${slug}' already exists in this workspace.`);
    }

    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          organizationId,
          name,
          slug,
          description,
          isSystem: false,
        },
      });

      if (permissionKeys.length > 0) {
        const permissions = await tx.permission.findMany({
          where: { key: { in: permissionKeys } },
        });

        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  async updateRole(id, { name, description, permissionKeys }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.role.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('Role not found');
      }
      if (existing.isSystem) {
        throw new Error('System roles cannot be modified');
      }

      await tx.role.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });

      if (permissionKeys !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionKeys.length > 0) {
          const permissions = await tx.permission.findMany({
            where: { key: { in: permissionKeys } },
          });
          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({
              roleId: id,
              permissionId: p.id,
            })),
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  async deleteRole(id) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.isSystem) {
      throw new Error('System roles cannot be deleted');
    }
    return prisma.role.delete({ where: { id } });
  }

  async getUserRoles(userId, organizationId) {
    return prisma.userRole.findMany({
      where: {
        userId,
        organizationId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async assignRole({ userId, roleId, organizationId, propertyScope = [] }) {
    return prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId,
          roleId,
          organizationId,
        },
      },
      update: {
        propertyScope,
      },
      create: {
        userId,
        roleId,
        organizationId,
        propertyScope,
      },
      include: {
        role: true,
        user: true,
      },
    });
  }

  async getUserPermissionsWithScope(userId, organizationId) {
    const userRoles = await this.getUserRoles(userId, organizationId);
    const permissionKeys = new Set();
    const propertyScopes = new Set();
    let hasGlobalAccess = false;

    for (const ur of userRoles) {
      if (!ur.propertyScope || ur.propertyScope.length === 0) {
        hasGlobalAccess = true;
      } else {
        ur.propertyScope.forEach((pId) => propertyScopes.add(pId));
      }

      for (const rp of ur.role.permissions) {
        permissionKeys.add(rp.permission.key);
      }
    }

    return {
      permissions: Array.from(permissionKeys),
      propertyScope: hasGlobalAccess ? [] : Array.from(propertyScopes),
      hasGlobalAccess,
      roles: userRoles.map((ur) => ur.role.slug),
    };
  }
}

export const rbacRepository = new RbacRepository();
