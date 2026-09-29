import { prisma } from '../../config/database.config.js';

export class UserRepository {
  async create(data) {
    return prisma.user.create({ data });
  }

  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        ownedOrganizations: true,
        organizationMembers: {
          include: {
            organization: true,
          },
        },
      },
    });
  }

  async findByMobile(mobile) {
    return prisma.user.findUnique({
      where: { mobile },
    });
  }

  async findByEmail(email) {
    if (!email) return null;
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async list({ skip = 0, take = 10, status } = {}) {
    const where = status ? { status } : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, users };
  }
}

export const userRepository = new UserRepository();
