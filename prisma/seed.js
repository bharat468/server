import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Properties
  { key: 'property.create', module: 'PROPERTY', description: 'Create properties' },
  { key: 'property.read', module: 'PROPERTY', description: 'View properties' },
  { key: 'property.update', module: 'PROPERTY', description: 'Update properties' },
  { key: 'property.delete', module: 'PROPERTY', description: 'Delete properties' },

  // Units
  { key: 'unit.create', module: 'UNIT', description: 'Create units in property' },
  { key: 'unit.read', module: 'UNIT', description: 'View units' },
  { key: 'unit.update', module: 'UNIT', description: 'Update units' },
  { key: 'unit.delete', module: 'UNIT', description: 'Delete units' },

  // Tenants
  { key: 'tenant.create', module: 'TENANT', description: 'Onboard tenants' },
  { key: 'tenant.read', module: 'TENANT', description: 'View tenant profiles' },
  { key: 'tenant.update', module: 'TENANT', description: 'Update tenant profiles' },

  // Leases
  { key: 'lease.create', module: 'LEASE', description: 'Create and activate leases' },
  { key: 'lease.read', module: 'LEASE', description: 'View lease agreements' },
  { key: 'lease.update', module: 'LEASE', description: 'Update lease terms' },
  { key: 'lease.terminate', module: 'LEASE', description: 'Terminate leases' },

  // Finance & Payments
  { key: 'payment.create', module: 'FINANCE', description: 'Record payments' },
  { key: 'payment.read', module: 'FINANCE', description: 'View payment ledgers' },
  { key: 'payment.update', module: 'FINANCE', description: 'Update payments' },

  // Maintenance
  { key: 'maintenance.create', module: 'MAINTENANCE', description: 'Create maintenance tickets' },
  { key: 'maintenance.read', module: 'MAINTENANCE', description: 'View maintenance tickets' },
  { key: 'maintenance.update', module: 'MAINTENANCE', description: 'Assign and update tickets' },

  // Reports
  { key: 'report.read', module: 'REPORTS', description: 'View financial and occupancy reports' },

  // RBAC
  { key: 'role.create', module: 'RBAC', description: 'Create custom roles' },
  { key: 'role.read', module: 'RBAC', description: 'View roles and permissions' },
  { key: 'role.assign', module: 'RBAC', description: 'Assign roles to members' },
];

async function getOrCreateSystemRole(slug, name, description) {
  let role = await prisma.role.findFirst({
    where: { slug, organizationId: null },
  });
  if (!role) {
    role = await prisma.role.create({
      data: { slug, name, description, isSystem: true },
    });
  }
  return role;
}

async function main() {
  console.log('Seeding database with RBAC permissions and system roles...');

  // 1. Seed Permissions
  const permissionMap = {};
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, module: p.module },
      create: p,
    });
    permissionMap[p.key] = perm.id;
  }
  console.log(`✓ Seeded ${PERMISSIONS.length} system permissions`);

  // 2. Seed System Roles (Global)
  // OWNER (All permissions)
  const ownerRole = await getOrCreateSystemRole(
    'owner',
    'Owner',
    'Complete administrative access to the organization'
  );

  for (const permId of Object.values(permissionMap)) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: permId } },
      update: {},
      create: { roleId: ownerRole.id, permissionId: permId },
    });
  }

  // PROPERTY_MANAGER
  const managerRole = await getOrCreateSystemRole(
    'property-manager',
    'Property Manager',
    'Can manage assigned properties, units, leases, and maintenance'
  );

  const managerPerms = [
    'property.read', 'property.update',
    'unit.create', 'unit.read', 'unit.update',
    'tenant.read', 'tenant.create',
    'lease.read', 'lease.create', 'lease.update',
    'payment.read',
    'maintenance.create', 'maintenance.read', 'maintenance.update',
  ];

  for (const key of managerPerms) {
    if (permissionMap[key]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permissionMap[key] } },
        update: {},
        create: { roleId: managerRole.id, permissionId: permissionMap[key] },
      });
    }
  }

  // ACCOUNTANT
  const accountantRole = await getOrCreateSystemRole(
    'accountant',
    'Accountant',
    'Can view financial records, record payments, and export reports'
  );

  const accountantPerms = [
    'property.read', 'unit.read', 'tenant.read', 'lease.read',
    'payment.read', 'payment.create', 'payment.update', 'report.read',
  ];

  for (const key of accountantPerms) {
    if (permissionMap[key]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: accountantRole.id, permissionId: permissionMap[key] } },
        update: {},
        create: { roleId: accountantRole.id, permissionId: permissionMap[key] },
      });
    }
  }

  console.log('✓ Seeded system roles (Owner, Property Manager, Accountant)');

  // 3. Platform SuperAdmin & Demo Organization
  await prisma.user.upsert({
    where: { mobile: '8003953815' },
    update: {
      isSuperAdmin: true,
      adminRole: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
    create: {
      mobile: '8003953815',
      name: 'SuperAdmin Master',
      email: 'master@rentmate.local',
      status: 'ACTIVE',
      isSuperAdmin: true,
      adminRole: 'SUPER_ADMIN',
    },
  });

  const owner = await prisma.user.upsert({
    where: { mobile: '9876543210' },
    update: {},
    create: {
      mobile: '9876543210',
      email: 'bharat@rentmate.local',
      name: 'Bharat',
      status: 'ACTIVE',
      isSuperAdmin: true,
      adminRole: 'SUPER_ADMIN',
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'bharat-estates' },
    update: {},
    create: {
      name: 'Bharat Estates',
      slug: 'bharat-estates',
      ownerId: owner.id,
      members: {
        create: {
          userId: owner.id,
          role: 'OWNER',
        },
      },
    },
  });

  // Assign OWNER role to Bharat in Bharat Estates
  await prisma.userRole.upsert({
    where: {
      userId_roleId_organizationId: {
        userId: owner.id,
        roleId: ownerRole.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      userId: owner.id,
      roleId: ownerRole.id,
      organizationId: organization.id,
      propertyScope: [], // Empty array = unrestricted access to all properties in organization
    },
  });

  // 4. Seed Demo Properties
  let prop1 = await prisma.property.findFirst({ where: { title: 'Sunrise Residency Flat 101' } });
  if (!prop1) {
    prop1 = await prisma.property.create({
      data: {
        title: 'Sunrise Residency Flat 101',
        address: '101, MG Road, Bandra West',
        city: 'Mumbai',
        rent: 32000,
        bedrooms: 2,
        status: 'OCCUPIED',
        organizationId: organization.id,
        ownerId: owner.id,
      },
    });
  }

  let prop2 = await prisma.property.findFirst({ where: { title: 'Green Villa Suite' } });
  if (!prop2) {
    prop2 = await prisma.property.create({
      data: {
        title: 'Green Villa Suite',
        address: 'Plot 45, Sector 14, Indiranagar',
        city: 'Bengaluru',
        rent: 48000,
        bedrooms: 3,
        status: 'OCCUPIED',
        organizationId: organization.id,
        ownerId: owner.id,
      },
    });
  }

  let prop3 = await prisma.property.findFirst({ where: { title: 'Skyline Tower 4B' } });
  if (!prop3) {
    prop3 = await prisma.property.create({
      data: {
        title: 'Skyline Tower 4B',
        address: 'Flat 4B, Hiranandani Gardens, Powai',
        city: 'Mumbai',
        rent: 25000,
        bedrooms: 1,
        status: 'VACANT',
        organizationId: organization.id,
        ownerId: owner.id,
      },
    });
  }

  console.log('✓ Seeded 3 demo properties (Sunrise Residency, Green Villa, Skyline Tower)');

  // 5. Seed Demo Tenants
  let tenant1 = await prisma.tenant.findFirst({ where: { email: 'rahul.sharma@example.com' } });
  if (!tenant1) {
    tenant1 = await prisma.tenant.create({
      data: {
        name: 'Rahul Sharma',
        email: 'rahul.sharma@example.com',
        phone: '9876543211',
        propertyId: prop1.id,
        leaseStart: '2026-01-01',
        leaseEnd: '2026-12-31',
      },
    });
  }

  let tenant2 = await prisma.tenant.findFirst({ where: { email: 'priya.patel@example.com' } });
  if (!tenant2) {
    tenant2 = await prisma.tenant.create({
      data: {
        name: 'Priya Patel',
        email: 'priya.patel@example.com',
        phone: '9876543212',
        propertyId: prop2.id,
        leaseStart: '2026-02-01',
        leaseEnd: '2027-01-31',
      },
    });
  }

  console.log('✓ Seeded 2 demo tenants (Rahul Sharma, Priya Patel)');

  // 6. Seed Demo Payments
  const existingPayments = await prisma.payment.count();
  if (existingPayments === 0) {
    await prisma.payment.createMany({
      data: [
        {
          tenantId: tenant1.id,
          propertyId: prop1.id,
          amount: 32000,
          month: '2026-09',
          status: 'PAID',
          paidOn: new Date('2026-09-05T10:00:00Z'),
        },
        {
          tenantId: tenant2.id,
          propertyId: prop2.id,
          amount: 48000,
          month: '2026-09',
          status: 'PAID',
          paidOn: new Date('2026-09-07T14:30:00Z'),
        },
        {
          tenantId: tenant1.id,
          propertyId: prop1.id,
          amount: 32000,
          month: '2026-10',
          status: 'PAID',
          paidOn: new Date('2026-10-02T11:15:00Z'),
        },
        {
          tenantId: tenant2.id,
          propertyId: prop2.id,
          amount: 48000,
          month: '2026-10',
          status: 'PENDING',
          paidOn: null,
        },
      ],
    });
    console.log('✓ Seeded 4 demo payments for September and October 2026');
  }

  // 6b. Seed Units, Leases & Maintenance Tickets for Platform Oversight
  let unit1 = await prisma.unit.findFirst({ where: { propertyId: prop1.id, unitNumber: '101' } });
  if (!unit1) {
    unit1 = await prisma.unit.create({
      data: {
        propertyId: prop1.id,
        unitNumber: '101',
        floor: 1,
        type: 'FLAT_2BHK',
        rentAmount: 32000,
        depositAmount: 64000,
        furnishing: 'SEMI_FURNISHED',
        status: 'OCCUPIED',
      },
    });
  }

  let unit2 = await prisma.unit.findFirst({ where: { propertyId: prop1.id, unitNumber: '102' } });
  if (!unit2) {
    unit2 = await prisma.unit.create({
      data: {
        propertyId: prop1.id,
        unitNumber: '102',
        floor: 1,
        type: 'FLAT_2BHK',
        rentAmount: 30000,
        depositAmount: 60000,
        furnishing: 'UNFURNISHED',
        status: 'VACANT',
      },
    });
  }

  let unit3 = await prisma.unit.findFirst({ where: { propertyId: prop2.id, unitNumber: 'Wing-A' } });
  if (!unit3) {
    unit3 = await prisma.unit.create({
      data: {
        propertyId: prop2.id,
        unitNumber: 'Wing-A',
        floor: 1,
        type: 'FLAT_3BHK',
        rentAmount: 48000,
        depositAmount: 96000,
        furnishing: 'FULLY_FURNISHED',
        status: 'OCCUPIED',
      },
    });
  }

  // 6b. Ensure Tenant User accounts exist for Leases & Maintenance Tickets
  const tenantUser1 = await prisma.user.upsert({
    where: { mobile: '9876543211' },
    update: { name: 'Rahul Sharma', email: 'rahul.sharma@example.com', status: 'ACTIVE' },
    create: {
      mobile: '9876543211',
      name: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      status: 'ACTIVE',
    },
  });

  const tenantUser2 = await prisma.user.upsert({
    where: { mobile: '9876543212' },
    update: { name: 'Priya Patel', email: 'priya.patel@example.com', status: 'ACTIVE' },
    create: {
      mobile: '9876543212',
      name: 'Priya Patel',
      email: 'priya.patel@example.com',
      status: 'ACTIVE',
    },
  });

  // Active Leases
  let lease1 = await prisma.lease.findFirst({ where: { propertyId: prop1.id, tenantId: tenantUser1.id } });
  if (!lease1) {
    lease1 = await prisma.lease.create({
      data: {
        propertyId: prop1.id,
        unitId: unit1.id,
        tenantId: tenantUser1.id,
        monthlyRent: 32000,
        securityDeposit: 64000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'ACTIVE',
        rentRule: {
          create: {
            dueDay: 5,
            graceDays: 3,
            penaltyType: 'PER_DAY',
            penaltyAmount: 100,
            maxPenaltyCap: 2000,
          },
        },
      },
    });
  }

  let lease2 = await prisma.lease.findFirst({ where: { propertyId: prop2.id, tenantId: tenantUser2.id } });
  if (!lease2) {
    lease2 = await prisma.lease.create({
      data: {
        propertyId: prop2.id,
        unitId: unit3.id,
        tenantId: tenantUser2.id,
        monthlyRent: 48000,
        securityDeposit: 96000,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2027-01-31'),
        status: 'ACTIVE',
        rentRule: {
          create: {
            dueDay: 1,
            graceDays: 5,
            penaltyType: 'PER_DAY',
            penaltyAmount: 150,
            maxPenaltyCap: 3000,
          },
        },
      },
    });
  }
  console.log('✓ Seeded demo Units and active Leases with Rent Rules');

  // Maintenance Tickets
  const existingTickets = await prisma.maintenanceRequest.count();
  if (existingTickets === 0) {
    await prisma.maintenanceRequest.createMany({
      data: [
        {
          propertyId: prop1.id,
          unitId: unit1.id,
          tenantId: tenantUser1.id,
          title: 'Bathroom shower mixer leakage',
          description: 'Water continuously dripping from the hot water mixer in master washroom.',
          category: 'PLUMBING',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          cost: 1200,
          notes: 'Plumber assigned, replacement valve ordered.',
        },
        {
          propertyId: prop2.id,
          unitId: unit3.id,
          tenantId: tenantUser2.id,
          title: 'Power trip on main AC circuit breaker',
          description: 'Breaker flips whenever both living room and master bedroom ACs are switched on simultaneously.',
          category: 'ELECTRICAL',
          priority: 'URGENT',
          status: 'OPEN',
          cost: 0,
        },
        {
          propertyId: prop1.id,
          unitId: unit1.id,
          tenantId: tenantUser1.id,
          title: 'Balcony sliding window lock alignment',
          description: 'Sliding lock latch getting stuck when closing completely.',
          category: 'CARPENTRY',
          priority: 'LOW',
          status: 'RESOLVED',
          cost: 450,
          notes: 'Lock adjusted and lubricated.',
        },
        {
          propertyId: prop3.id,
          unitId: null,
          tenantId: tenantUser1.id,
          title: 'Touch-up paint required before new tenant move-in',
          description: 'Entry foyer and hallway wall need touch-up paint.',
          category: 'PAINTING',
          priority: 'MEDIUM',
          status: 'OPEN',
          cost: 0,
        },
      ],
    });
    console.log('✓ Seeded 4 demo maintenance complaints and repair tickets');
  }

  // 7. Seed Default SaaS Plans
  const plans = [
    {
      name: 'Free Starter',
      slug: 'free-starter',
      description: 'Ideal for small landlords managing 1-5 properties',
      priceMonthly: 0,
      priceYearly: 0,
      maxProperties: 5,
      maxTenants: 10,
      maxStaff: 2,
      features: ['Basic Property Tracking', 'Tenant Directory', 'Manual Rent Ledger'],
      isActive: true,
    },
    {
      name: 'Growth Plan',
      slug: 'growth-plan',
      description: 'For growing property management portfolios and teams',
      priceMonthly: 1499,
      priceYearly: 14990,
      maxProperties: 25,
      maxTenants: 60,
      maxStaff: 5,
      features: ['Up to 25 Properties', 'Multi-user Staff Roles', 'Custom Dynamic Roles', 'Financial Reports'],
      isActive: true,
    },
    {
      name: 'Enterprise Pro',
      slug: 'enterprise-pro',
      description: 'Complete autonomous management for large real estate operators',
      priceMonthly: 4999,
      priceYearly: 49990,
      maxProperties: 200,
      maxTenants: 500,
      maxStaff: 20,
      features: ['Unlimited Scale', 'Advanced RBAC & Scopes', 'Priority 24/7 Support', 'Custom Integrations'],
      isActive: true,
    },
  ];

  let growthPlan;
  for (const p of plans) {
    const createdPlan = await prisma.plan.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
    if (p.slug === 'growth-plan') growthPlan = createdPlan;
  }
  console.log('✓ Seeded 3 default SaaS subscription plans (Free Starter, Growth Plan, Enterprise Pro)');

  // 8. Assign Growth Plan Subscription to Demo Organization
  const existingSub = await prisma.subscription.findFirst({
    where: { organizationId: organization.id },
  });
  if (!existingSub && growthPlan) {
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: growthPlan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 Year
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✓ Subscribed "${organization.name}" to "${growthPlan.name}"`);
  } else if (existingSub && !existingSub.expiresAt) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    });
  }

  // 9. Seed SuperAdmin Roles
  const superAdminRoles = [
    {
      name: 'Super Administrator',
      slug: 'super-admin',
      description: 'Unrestricted master access across all platform organizations, plans, and security controls',
      permissions: ['admin.all', 'admin.orgs.manage', 'admin.plans.manage', 'admin.roles.manage', 'admin.billing.manage'],
    },
    {
      name: 'Support Administrator',
      slug: 'support-admin',
      description: 'Read-only organization inspection, user troubleshooting and customer assistance',
      permissions: ['admin.orgs.read', 'admin.users.read', 'admin.support'],
    },
    {
      name: 'Billing Administrator',
      slug: 'billing-admin',
      description: 'Manages SaaS pricing plans, assigns quotas, and monitors subscription revenues',
      permissions: ['admin.plans.manage', 'admin.billing.manage', 'admin.invoices'],
    },
  ];

  for (const sar of superAdminRoles) {
    await prisma.superAdminRole.upsert({
      where: { slug: sar.slug },
      update: sar,
      create: sar,
    });
  }
  console.log('✓ Seeded 3 SuperAdmin platform roles (Super Admin, Support Admin, Billing Admin)');

  console.log(`✓ Demo Owner assigned OWNER role in "${organization.name}"`);
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
