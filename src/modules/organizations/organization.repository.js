import { prisma } from '../../config/database.config.js';

export class OrganizationRepository {
  async create({ name, slug, ownerId }) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          ownerId,
        },
      });

      // Automatically add owner as ADMIN member
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: ownerId,
          role: 'ADMIN',
        },
      });

      return org;
    });
  }

  async findById(id) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        owner: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findBySlug(slug) {
    return prisma.organization.findUnique({
      where: { slug },
    });
  }

  async findByOwnerId(ownerId) {
    return prisma.organization.findMany({
      where: { ownerId },
      include: {
        members: true,
      },
    });
  }

  async addMember(organizationId, userId, role = 'MEMBER') {
    return prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        role,
      },
      include: {
        user: true,
      },
    });
  }
}

export const organizationRepository = new OrganizationRepository();
