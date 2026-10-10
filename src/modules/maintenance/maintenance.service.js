import { maintenanceRepository } from './maintenance.repository.js';
import { propertyRepository } from '../properties/property.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class MaintenanceService {
  async listTickets(query, user) {
    const scope = await getUserScope(user);

    // If regular user without landlord/superadmin role, return their own tenant tickets
    if (!scope.isSuperAdmin && scope.orgIds.length === 0) {
      return maintenanceRepository.listForTenant(user.id);
    }

    const where = {};
    if (!scope.isSuperAdmin) {
      where.property = {
        OR: [
          { organizationId: { in: scope.orgIds } },
          { ownerId: user.id },
          { createdById: user.id },
        ],
      };
      if (scope.propertyScope.length > 0) {
        where.propertyId = { in: scope.propertyScope };
      }
    }

    return maintenanceRepository.listForOwner({
      propertyId: query.propertyId,
      status: query.status,
      priority: query.priority,
      where,
    });
  }

  async listMyTenantTickets(user) {
    return maintenanceRepository.listForTenant(user.id);
  }

  async createTicket(payload, user) {
    const property = await propertyRepository.findById(payload.propertyId);
    if (!property) {
      throw new ApiError(404, 'Associated property not found');
    }

    return maintenanceRepository.create({
      propertyId: payload.propertyId,
      unitId: payload.unitId || null,
      tenantId: user.id,
      title: payload.title,
      description: payload.description,
      category: payload.category || 'PLUMBING',
      priority: payload.priority || 'MEDIUM',
      status: 'OPEN',
      notes: payload.notes || null,
    });
  }

  async assignStaff(id, { assignedStaffId }, user) {
    const ticket = await maintenanceRepository.findById(id);
    if (!ticket) {
      throw new ApiError(404, 'Maintenance ticket not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin && ticket.property) {
        const hasAccess =
          ticket.property.ownerId === user.id ||
          ticket.property.createdById === user.id ||
          scope.orgIds.includes(ticket.property.organizationId);

        if (!hasAccess) {
          throw new ApiError(
            403,
            'Access denied: You cannot assign staff to tickets on properties you do not manage'
          );
        }
      }
    }

    return maintenanceRepository.update(id, {
      assignedStaffId,
      status: 'ASSIGNED',
    });
  }

  async updateStatus(id, { status, cost, notes }, user) {
    const ticket = await maintenanceRepository.findById(id);
    if (!ticket) {
      throw new ApiError(404, 'Maintenance ticket not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      const isTicketTenant = ticket.tenantId === user.id;
      const isStaffAssigned = ticket.assignedStaffId === user.id;
      const isOwnerOrAdmin =
        scope.isSuperAdmin ||
        (ticket.property &&
          (ticket.property.ownerId === user.id ||
            ticket.property.createdById === user.id ||
            scope.orgIds.includes(ticket.property.organizationId)));

      if (!isTicketTenant && !isStaffAssigned && !isOwnerOrAdmin) {
        throw new ApiError(
          403,
          'Access denied: You cannot update the status of this maintenance ticket'
        );
      }
    }

    const data = { status };
    if (cost !== undefined) data.cost = parseFloat(cost);
    if (notes) data.notes = notes;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      data.resolvedAt = new Date();
    }

    return maintenanceRepository.update(id, data);
  }
}

export const maintenanceService = new MaintenanceService();
