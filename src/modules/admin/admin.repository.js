import { prisma } from '../../config/database.config.js';

export class AdminRepository {
  async listUsers() {
    return prisma.user.findMany({
      include: {
        organizationMembers: {
          include: {
            organization: true,
          },
        },
        userRoles: {
          include: {
            role: true,
            organization: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser({ mobile, name, email, roleId, organizationId, propertyScope = [] }) {
    return prisma.$transaction(async (tx) => {
      // 1. Create or retrieve user by mobile
      let user = await tx.user.findUnique({ where: { mobile } });
      if (!user) {
        user = await tx.user.create({
          data: {
            mobile,
            name: name || null,
            email: email || null,
            status: 'ACTIVE',
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
          },
        });
      }

      // 2. Ensure default or provided organization exists
      let targetOrgId = organizationId;
      if (!targetOrgId) {
        const firstOrg = await tx.organization.findFirst();
        targetOrgId = firstOrg?.id;
      }

      if (targetOrgId) {
        // Add as organization member
        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: targetOrgId,
              userId: user.id,
            },
          },
          update: {},
          create: {
            organizationId: targetOrgId,
            userId: user.id,
            role: 'MEMBER',
          },
        });

        // 3. Assign role if provided
        if (roleId) {
          await tx.userRole.upsert({
            where: {
              userId_roleId_organizationId: {
                userId: user.id,
                roleId,
                organizationId: targetOrgId,
              },
            },
            update: {
              propertyScope,
            },
            create: {
              userId: user.id,
              roleId,
              organizationId: targetOrgId,
              propertyScope,
            },
          });
        }
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          organizationMembers: { include: { organization: true } },
          userRoles: { include: { role: true, organization: true } },
        },
      });
    });
  }

  async updateUserStatus(userId, status) {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
      include: {
        organizationMembers: { include: { organization: true } },
        userRoles: { include: { role: true, organization: true } },
      },
    });
  }

  async updateUserRole({ userId, roleId, organizationId, propertyScope = [] }) {
    return prisma.$transaction(async (tx) => {
      // Remove previous role in this organization if different
      await tx.userRole.deleteMany({
        where: { userId, organizationId },
      });

      return tx.userRole.create({
        data: {
          userId,
          roleId,
          organizationId,
          propertyScope,
        },
        include: {
          role: true,
          organization: true,
        },
      });
    });
  }

  async getPlatformOverview() {
    const [totalUsers, totalProperties, totalTenants, totalPayments, plans] =
      await Promise.all([
        prisma.user.count(),
        prisma.property.count(),
        prisma.tenant.count(),
        prisma.payment.count(),
        prisma.plan.findMany({ where: { isActive: true } }),
      ]);

    const payments = await prisma.payment.findMany();
    const totalCollected = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalUsers,
      totalProperties,
      totalTenants,
      totalPayments,
      totalCollected,
      activePlans: plans.length,
    };
  }

  // SuperAdmin RBAC Role Repository Methods
  async listSuperAdminRoles() {
    return prisma.superAdminRole.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSuperAdminRole({ name, slug, description, permissions = [] }) {
    const roleSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return prisma.superAdminRole.create({
      data: {
        name,
        slug: roleSlug,
        description,
        permissions,
      },
    });
  }

  async updateSuperAdminRole(id, data) {
    return prisma.superAdminRole.update({
      where: { id },
      data,
    });
  }

  async deleteSuperAdminRole(id) {
    return prisma.superAdminRole.delete({
      where: { id },
    });
  }

  async assignAdminRole(userId, { isSuperAdmin, adminRole }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isSuperAdmin: Boolean(isSuperAdmin),
        adminRole: adminRole || null,
      },
    });
  }

  // Organizations & SaaS Subscription Control
  async listOrganizationsWithSubscriptions() {
    const orgs = await prisma.organization.findMany({
      include: {
        owner: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        _count: {
          select: {
            members: true,
            properties: true,
          },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orgs.map((org) => {
      const activeSub = org.subscriptions?.[0] || null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        owner: org.owner,
        memberCount: org._count.members,
        propertyCount: org._count.properties,
        subscription: activeSub
          ? {
              id: activeSub.id,
              status: activeSub.status,
              planId: activeSub.planId,
              planName: activeSub.plan?.name,
              planSlug: activeSub.plan?.slug,
              maxProperties: activeSub.plan?.maxProperties,
              maxStaff: activeSub.plan?.maxStaff,
              expiresAt: activeSub.expiresAt,
            }
          : null,
        createdAt: org.createdAt,
      };
    });
  }

  async updateOrganizationSubscription(organizationId, { planId, expiresAt, status }) {
    const currentSub = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (currentSub) {
      return prisma.subscription.update({
        where: { id: currentSub.id },
        data: {
          ...(planId ? { planId } : {}),
          ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
          ...(status ? { status } : {}),
        },
        include: { plan: true },
      });
    } else {
      return prisma.subscription.create({
        data: {
          organizationId,
          planId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          status: status || 'ACTIVE',
        },
        include: { plan: true },
      });
    }
  }
}

export const adminRepository = new AdminRepository();
