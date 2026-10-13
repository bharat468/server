import { prisma } from '../../config/database.config.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';
import { ApiError } from '../../common/errors/apiError.js';

export class ReportsService {
  /**
   * Helper to build property scoping clause
   */
  async getScopedPropertyWhere(user) {
    const scope = await getUserScope(user);

    if (scope.isSuperAdmin) {
      return {};
    }

    if (scope.orgIds.length === 0 && !user?.id) {
      return { id: '__no_access__' };
    }

    const where = {
      OR: [
        { organizationId: { in: scope.orgIds } },
        { ownerId: user.id },
        { createdById: user.id },
      ],
    };

    if (scope.propertyScope.length > 0) {
      where.id = { in: scope.propertyScope };
    }

    return where;
  }

  /**
   * 1. Monthly Rent Collection Report (BRD Sec 25.1)
   */
  async getMonthlyRentCollections({ month, propertyId }, user) {
    const whereProperty = await this.getScopedPropertyWhere(user);

    if (propertyId) {
      whereProperty.id = propertyId;
    }

    const wherePayment = {
      property: whereProperty,
    };

    if (month && month.trim()) {
      wherePayment.month = month.trim();
    }

    const payments = await prisma.payment.findMany({
      where: wherePayment,
      include: {
        tenant: true,
        property: true,
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    });

    const paidPayments = payments.filter((p) => p.status === 'PAID');
    const pendingPayments = payments.filter((p) => p.status === 'PENDING');
    const overduePayments = payments.filter((p) => p.status === 'OVERDUE');

    const totalCollected = paidPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalPending = pendingPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalOverdue = overduePayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalExpected = totalCollected + totalPending + totalOverdue;
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    const items = payments.map((p) => ({
      id: p.id,
      receiptNo: `REC-${p.id.slice(-6).toUpperCase()}`,
      month: p.month,
      tenantName: p.tenant?.name || 'Tenant',
      tenantPhone: p.tenant?.phone || 'N/A',
      tenantEmail: p.tenant?.email || 'N/A',
      propertyId: p.propertyId,
      propertyTitle: p.property?.title || 'Unknown Property',
      propertyCity: p.property?.city || 'N/A',
      propertyAddress: p.property?.address || 'N/A',
      amount: Number(p.amount || 0),
      status: p.status,
      paidOn: p.paidOn ? p.paidOn.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    }));

    return {
      summary: {
        filterMonth: month || 'ALL',
        filterPropertyId: propertyId || 'ALL',
        totalCollected,
        totalPending,
        totalOverdue,
        totalExpected,
        collectionRate,
        totalTransactions: payments.length,
        paidCount: paidPayments.length,
        pendingCount: pendingPayments.length,
        overdueCount: overduePayments.length,
      },
      items,
    };
  }

  /**
   * 2. Pending Defaulters List (BRD Sec 25.2)
   */
  async getDefaultersReport(user) {
    const whereProperty = await this.getScopedPropertyWhere(user);

    // 1. Fetch pending & overdue payments
    const payments = await prisma.payment.findMany({
      where: {
        property: whereProperty,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        tenant: true,
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch pending & overdue rent schedules from leases
    const schedules = await prisma.rentSchedule.findMany({
      where: {
        status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
        lease: {
          property: whereProperty,
        },
      },
      include: {
        lease: {
          include: {
            property: true,
            unit: true,
            tenant: {
              select: { id: true, name: true, mobile: true, email: true },
            },
            rentRule: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const defaultersMap = new Map();

    // Process Rent Schedules
    for (const s of schedules) {
      const lease = s.lease;
      const dueDate = new Date(s.dueDate);
      const diffTime = Math.max(0, now.getTime() - dueDate.getTime());
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const key = `${lease.tenantId}_${lease.propertyId}_${s.period}`;
      const baseAmount = Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0));
      const penaltyAmount = Number(s.penaltyAmount || 0);

      defaultersMap.set(key, {
        id: s.id,
        source: 'LEASE_SCHEDULE',
        tenantName: lease.tenant?.name || 'Tenant',
        tenantPhone: lease.tenant?.mobile || 'N/A',
        tenantEmail: lease.tenant?.email || 'N/A',
        propertyId: lease.propertyId,
        propertyTitle: lease.property?.title || 'Unknown Property',
        unitNumber: lease.unit?.unitNumber || 'Main Unit',
        month: s.period,
        dueDate: s.dueDate.toISOString().split('T')[0],
        daysOverdue,
        baseAmount,
        penaltyAmount,
        totalOutstanding: baseAmount + penaltyAmount,
        status: daysOverdue > (lease.rentRule?.graceDays || 0) ? 'OVERDUE' : s.status,
      });
    }

    // Process Payments (merge or add)
    for (const p of payments) {
      const key = `${p.tenantId}_${p.propertyId}_${p.month}`;
      if (!defaultersMap.has(key)) {
        // Approximate due date as 5th of that billing month
        const [year, month] = (p.month || '2026-10').split('-').map(Number);
        const approxDueDate = new Date(year, (month || 1) - 1, 5);
        const diffTime = Math.max(0, now.getTime() - approxDueDate.getTime());
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        defaultersMap.set(key, {
          id: p.id,
          source: 'PAYMENT_RECORD',
          tenantName: p.tenant?.name || 'Tenant',
          tenantPhone: p.tenant?.phone || 'N/A',
          tenantEmail: p.tenant?.email || 'N/A',
          propertyId: p.propertyId,
          propertyTitle: p.property?.title || 'Unknown Property',
          unitNumber: 'Primary Unit',
          month: p.month,
          dueDate: approxDueDate.toISOString().split('T')[0],
          daysOverdue,
          baseAmount: Number(p.amount || 0),
          penaltyAmount: daysOverdue > 5 ? Math.min(2000, daysOverdue * 100) : 0,
          totalOutstanding: Number(p.amount || 0) + (daysOverdue > 5 ? Math.min(2000, daysOverdue * 100) : 0),
          status: p.status,
        });
      }
    }

    const items = Array.from(defaultersMap.values()).sort(
      (a, b) => b.daysOverdue - a.daysOverdue || b.totalOutstanding - a.totalOutstanding
    );

    const totalOverdueAmount = items.reduce((acc, d) => acc + d.baseAmount, 0);
    const totalPenaltyAccrued = items.reduce((acc, d) => acc + d.penaltyAmount, 0);
    const totalOutstanding = items.reduce((acc, d) => acc + d.totalOutstanding, 0);

    return {
      summary: {
        totalDefaulters: items.length,
        totalOverdueAmount,
        totalPenaltyAccrued,
        totalOutstanding,
      },
      items,
    };
  }

  /**
   * 3. Property-wise Profit & Loss / Expense Report (BRD Sec 25.3)
   */
  async getPropertyProfitAndLossReport(user) {
    const whereProperty = await this.getScopedPropertyWhere(user);

    // 1. Fetch properties
    const properties = await prisma.property.findMany({
      where: whereProperty,
      include: {
        units: true,
        payments: true,
        maintenanceRequests: true,
      },
      orderBy: { title: 'asc' },
    });

    let portfolioRevenue = 0;
    let portfolioPending = 0;
    let portfolioExpenses = 0;

    const items = properties.map((prop) => {
      const paidPayments = prop.payments.filter((p) => p.status === 'PAID');
      const pendingPayments = prop.payments.filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE');

      const collectedIncome = paidPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const pendingReceivables = pendingPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

      // Maintenance expenses (cost accrued on all maintenance tickets)
      const maintenanceCost = prop.maintenanceRequests.reduce(
        (acc, m) => acc + Number(m.cost || 0),
        0
      );

      const netProfit = collectedIncome - maintenanceCost;
      const profitMargin =
        collectedIncome > 0
          ? Math.round((netProfit / collectedIncome) * 1000) / 10
          : maintenanceCost > 0
          ? -100
          : 0;

      portfolioRevenue += collectedIncome;
      portfolioPending += pendingReceivables;
      portfolioExpenses += maintenanceCost;

      const occupiedUnits = prop.units.filter((u) => u.status === 'OCCUPIED').length;
      const totalUnits = Math.max(prop.units.length, 1);

      return {
        propertyId: prop.id,
        propertyTitle: prop.title,
        address: prop.address,
        city: prop.city,
        status: prop.status,
        monthlyRentBase: Number(prop.rent || 0),
        totalUnits,
        occupiedUnits,
        vacantUnits: totalUnits - occupiedUnits,
        grossIncome: collectedIncome,
        pendingReceivables,
        totalExpenses: maintenanceCost,
        netProfit,
        profitMargin,
        maintenanceTicketsCount: prop.maintenanceRequests.length,
        resolvedTicketsCount: prop.maintenanceRequests.filter(
          (m) => m.status === 'RESOLVED' || m.status === 'CLOSED'
        ).length,
      };
    });

    const netOperatingIncome = portfolioRevenue - portfolioExpenses;
    const portfolioMargin =
      portfolioRevenue > 0
        ? Math.round((netOperatingIncome / portfolioRevenue) * 1000) / 10
        : portfolioExpenses > 0
        ? -100
        : 0;

    return {
      summary: {
        totalProperties: properties.length,
        portfolioRevenue,
        portfolioPending,
        portfolioExpenses,
        netOperatingIncome,
        portfolioMargin,
      },
      items,
    };
  }
}

export const reportsService = new ReportsService();
