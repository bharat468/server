import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../common/errors/apiError.js';

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
    const existing = await prisma.plan.findUnique({ where: { slug } });
    if (existing) {
      throw new ApiError(
        409,
        `A SaaS plan with slug '${slug}' already exists. Please choose a different plan name or slug.`
      );
    }

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
    const current = await prisma.plan.findUnique({ where: { id } });
    if (!current) {
      throw new ApiError(404, 'Plan not found');
    }

    if (data.slug && data.slug !== current.slug) {
      const slugMatch = await prisma.plan.findUnique({ where: { slug: data.slug } });
      if (slugMatch && slugMatch.id !== id) {
        throw new ApiError(409, `A SaaS plan with slug '${data.slug}' already exists.`);
      }
    }

    return prisma.plan.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
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
    const subCount = await prisma.subscription.count({ where: { planId: id } });
    if (subCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete plan because ${subCount} organization(s) are currently subscribed to it. Deactivate the plan instead.`
      );
    }

    return prisma.plan.delete({
      where: { id },
    });
  }
}

export const planRepository = new PlanRepository();
