import { prisma } from '../../config/database.config.js';

export class PlanRepository {
  async list() {
    return prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async findById(id) {
    return prisma.plan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { organization: true },
        },
      },
    });
  }

  async create(data) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return prisma.plan.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        priceMonthly: parseFloat(data.priceMonthly || 0),
        priceYearly: parseFloat(data.priceYearly || 0),
        maxProperties: parseInt(data.maxProperties || 5, 10),
        maxTenants: parseInt(data.maxTenants || 10, 10),
        maxStaff: parseInt(data.maxStaff || 2, 10),
        features: Array.isArray(data.features) ? data.features : [],
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(id, data) {
    return prisma.plan.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priceMonthly !== undefined ? { priceMonthly: parseFloat(data.priceMonthly) } : {}),
        ...(data.priceYearly !== undefined ? { priceYearly: parseFloat(data.priceYearly) } : {}),
        ...(data.maxProperties !== undefined ? { maxProperties: parseInt(data.maxProperties, 10) } : {}),
        ...(data.maxTenants !== undefined ? { maxTenants: parseInt(data.maxTenants, 10) } : {}),
        ...(data.maxStaff !== undefined ? { maxStaff: parseInt(data.maxStaff, 10) } : {}),
        ...(data.features ? { features: data.features } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async delete(id) {
    return prisma.plan.delete({
      where: { id },
    });
  }
}

export const planRepository = new PlanRepository();
