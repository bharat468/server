import { reportsService } from './reports.service.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function buildCsv(headers, rows) {
  const headerRow = headers.map(escapeCsvCell).join(',');
  const dataRows = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerRow, ...dataRows].join('\r\n');
}

export class ReportsController {
  /**
   * 1. Monthly Rent Collection Report
   * GET /api/v1/reports/monthly-collections?month=2026-10&propertyId=...&format=csv
   */
  getMonthlyCollections = asyncHandler(async (req, res) => {
    const { month, propertyId, format } = req.query;
    const data = await reportsService.getMonthlyRentCollections({ month, propertyId }, req.user);

    if (format === 'csv') {
      const headers = [
        'Receipt No',
        'Billing Month',
        'Tenant Name',
        'Tenant Phone',
        'Tenant Email',
        'Property Name',
        'City',
        'Amount (INR)',
        'Status',
        'Paid Date',
      ];

      const rows = data.items.map((item) => [
        item.receiptNo,
        item.month,
        item.tenantName,
        item.tenantPhone,
        item.tenantEmail,
        item.propertyTitle,
        item.propertyCity,
        item.amount,
        item.status,
        item.paidOn ? new Date(item.paidOn).toLocaleDateString('en-IN') : 'N/A',
      ]);

      const csvContent = buildCsv(headers, rows);
      const filename = `rentmate-monthly-collections-${month || 'all'}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    }

    res.status(200).json(
      new ApiResponse(200, data, 'Monthly rent collection report generated successfully')
    );
  });

  /**
   * 2. Pending Defaulters List
   * GET /api/v1/reports/defaulters?format=csv
   */
  getDefaulters = asyncHandler(async (req, res) => {
    const { format } = req.query;
    const data = await reportsService.getDefaultersReport(req.user);

    if (format === 'csv') {
      const headers = [
        'Tenant Name',
        'Phone Number',
        'Email Address',
        'Property Name',
        'Unit Number',
        'Billing Month',
        'Due Date',
        'Days Overdue',
        'Base Due (INR)',
        'Penalty Accrued (INR)',
        'Total Outstanding (INR)',
        'Status',
      ];

      const rows = data.items.map((item) => [
        item.tenantName,
        item.tenantPhone,
        item.tenantEmail,
        item.propertyTitle,
        item.unitNumber,
        item.month,
        item.dueDate,
        item.daysOverdue,
        item.baseAmount,
        item.penaltyAmount,
        item.totalOutstanding,
        item.status,
      ]);

      const csvContent = buildCsv(headers, rows);
      const filename = `rentmate-pending-defaulters-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    }

    res.status(200).json(
      new ApiResponse(200, data, 'Pending defaulters report generated successfully')
    );
  });

  /**
   * 3. Property-wise Profit & Loss / Expense Report
   * GET /api/v1/reports/property-pnl?format=csv
   */
  getPropertyProfitAndLoss = asyncHandler(async (req, res) => {
    const { format } = req.query;
    const data = await reportsService.getPropertyProfitAndLossReport(req.user);

    if (format === 'csv') {
      const headers = [
        'Property Name',
        'Address',
        'City',
        'Occupancy Status',
        'Total Units',
        'Occupied Units',
        'Vacant Units',
        'Gross Rent Collected (INR)',
        'Pending Rent Receivables (INR)',
        'Maintenance Expenses (INR)',
        'Net Operating Profit (INR)',
        'Operating Margin (%)',
        'Maintenance Tickets Total',
        'Resolved Tickets',
      ];

      const rows = data.items.map((item) => [
        item.propertyTitle,
        item.address,
        item.city,
        item.status,
        item.totalUnits,
        item.occupiedUnits,
        item.vacantUnits,
        item.grossIncome,
        item.pendingReceivables,
        item.totalExpenses,
        item.netProfit,
        `${item.profitMargin}%`,
        item.maintenanceTicketsCount,
        item.resolvedTicketsCount,
      ]);

      const csvContent = buildCsv(headers, rows);
      const filename = `rentmate-property-pnl-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    }

    res.status(200).json(
      new ApiResponse(200, data, 'Property-wise Profit & Loss report generated successfully')
    );
  });
}

export const reportsController = new ReportsController();
