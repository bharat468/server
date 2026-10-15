import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--------------------------------------------------");
  console.log("Setting up Admin Bharat (8003953815) with 5 Real Users & Buildings...");
  console.log("--------------------------------------------------");

  // Free up email if used by other test user
  await prisma.user.updateMany({
    where: { email: "bharat@rentmate.local", mobile: { not: "8003953815" } },
    data: { email: "demo.user@rentmate.local" },
  });

  // 1. Find or Update Admin Bharat (8003953815)
  let admin = await prisma.user.findFirst({
    where: { mobile: "8003953815" },
  });

  if (admin) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        name: "Bharat",
        email: "bharat@rentmate.local",
        isSuperAdmin: true,
      },
    });
  } else {
    admin = await prisma.user.create({
      data: {
        mobile: "8003953815",
        name: "Bharat",
        email: "bharat@rentmate.local",
        isSuperAdmin: true,
      },
    });
  }

  // 2. Setup Organization: "Bharat Estates"
  let org = await prisma.organization.findFirst({
    where: { slug: "bharat-estates" },
  });

  if (org) {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        ownerId: admin.id,
        name: "Bharat Estates",
        electricityRate: 9.0,
        waterRate: 20.0,
      },
    });
  } else {
    org = await prisma.organization.create({
      data: {
        name: "Bharat Estates",
        slug: "bharat-estates",
        ownerId: admin.id,
        electricityRate: 9.0,
        waterRate: 20.0,
      },
    });
  }

  // Add admin as organization member with OWNER role
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: admin.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      organizationId: org.id,
      userId: admin.id,
      role: "OWNER",
    },
  });

  // Assign OWNER role in userRoles if role exists
  const ownerRole = await prisma.role.findFirst({ where: { slug: "owner" } });
  if (ownerRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: admin.id,
          roleId: ownerRole.id,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: ownerRole.id,
        organizationId: org.id,
      },
    });
  }

  console.log(`Admin configured: ${admin.name} (${admin.mobile}) -> ${org.name}`);

  // 3. Create 2 Realistic Properties / Buildings
  // Property A: Pareek Tower
  const propA = await prisma.property.create({
    data: {
      title: "Pareek Tower",
      address: "Plot 12, Subhash Marg, C-Scheme",
      city: "Jaipur",
      rent: 14000,
      bedrooms: 2,
      status: "OCCUPIED",
      organizationId: org.id,
      ownerId: admin.id,
      createdById: admin.id,
    },
  });

  // Property B: Geeta Villa
  const propB = await prisma.property.create({
    data: {
      title: "Geeta Villa",
      address: "B-44, Sector 3, Malviya Nagar",
      city: "Jaipur",
      rent: 12000,
      bedrooms: 2,
      status: "OCCUPIED",
      organizationId: org.id,
      ownerId: admin.id,
      createdById: admin.id,
    },
  });

  console.log("Created 2 Buildings: Pareek Tower & Geeta Villa");

  // 4. Create 5 Units across these 2 buildings
  const unit101 = await prisma.unit.create({
    data: {
      propertyId: propA.id,
      unitNumber: "Unit 101",
      floor: 1,
      type: "FLAT_2BHK",
      areaSqFt: 1150,
      rentAmount: 14000,
      depositAmount: 28000,
      furnishing: "SEMI_FURNISHED",
      status: "OCCUPIED",
    },
  });

  const unit102 = await prisma.unit.create({
    data: {
      propertyId: propA.id,
      unitNumber: "Unit 102",
      floor: 1,
      type: "FLAT_2BHK",
      areaSqFt: 1200,
      rentAmount: 15000,
      depositAmount: 30000,
      furnishing: "FULLY_FURNISHED",
      status: "OCCUPIED",
    },
  });

  const unit201 = await prisma.unit.create({
    data: {
      propertyId: propA.id,
      unitNumber: "Unit 201",
      floor: 2,
      type: "FLAT_3BHK",
      areaSqFt: 1650,
      rentAmount: 22000,
      depositAmount: 44000,
      furnishing: "FULLY_FURNISHED",
      status: "OCCUPIED",
    },
  });

  const unitF01 = await prisma.unit.create({
    data: {
      propertyId: propB.id,
      unitNumber: "Unit F01",
      floor: 1,
      type: "FLAT_2BHK",
      areaSqFt: 1050,
      rentAmount: 12000,
      depositAmount: 24000,
      furnishing: "SEMI_FURNISHED",
      status: "OCCUPIED",
    },
  });

  const unitS02 = await prisma.unit.create({
    data: {
      propertyId: propB.id,
      unitNumber: "Unit S02",
      floor: 2,
      type: "FLAT_1BHK",
      areaSqFt: 650,
      rentAmount: 8500,
      depositAmount: 17000,
      furnishing: "UNFURNISHED",
      status: "OCCUPIED",
    },
  });

  console.log("Created 5 Units: 101, 102, 201 (Pareek Tower) & F01, S02 (Geeta Villa)");

  // 5. Setup 5 Real Users (Tenants) with Ongoing Real Data
  const usersData = [
    {
      name: "Amit Sharma",
      mobile: "9829012345",
      email: "amit.sharma@gmail.com",
      unit: unit101,
      property: propA,
      monthlyRent: 14000,
      deposit: 28000,
      leaseStart: new Date("2026-01-01"),
      leaseEnd: new Date("2026-11-30"),
      status: "ACTIVE",
      elecPrev: 410,
      elecCurr: 525,
      waterPrev: 30,
      waterCurr: 42,
      paymentMonth: "October, 2026",
      paymentStatus: "PAID",
      paidOn: new Date("2026-10-04"),
    },
    {
      name: "Vikram Singh Rathore",
      mobile: "9414056789",
      email: "vikram.rathore@outlook.com",
      unit: unit102,
      property: propA,
      monthlyRent: 15000,
      deposit: 30000,
      leaseStart: new Date("2025-11-15"),
      // Expiring in 14 days from today (Oct 15 -> Oct 29, 2026) -> Trigger for Expiring Leases Widget!
      leaseEnd: new Date("2026-10-29"),
      status: "EXPIRING",
      elecPrev: 840,
      elecCurr: 960,
      waterPrev: 45,
      waterCurr: 58,
      paymentMonth: "October, 2026",
      paymentStatus: "PENDING",
      paidOn: null,
    },
    {
      name: "Pooja Verma",
      mobile: "9783011223",
      email: "pooja.verma@yahoo.com",
      unit: unit201,
      property: propA,
      monthlyRent: 22000,
      deposit: 44000,
      leaseStart: new Date("2026-03-01"),
      leaseEnd: new Date("2027-01-31"),
      status: "ACTIVE",
      elecPrev: 1200,
      elecCurr: 1380,
      waterPrev: 80,
      waterCurr: 102,
      paymentMonth: "October, 2026",
      paymentStatus: "OVERDUE",
      paidOn: null,
      hasMaintenance: true,
      maintenanceTitle: "Kitchen Sink Pipe Leakage",
      maintenanceDesc: "Water leaking under the modular kitchen sink causing dampness. Urgent plumbing needed.",
      maintenanceCategory: "PLUMBING",
      maintenancePriority: "HIGH",
    },
    {
      name: "Deepak Meena",
      mobile: "9602033445",
      email: "deepak.meena@gmail.com",
      unit: unitF01,
      property: propB,
      monthlyRent: 12000,
      deposit: 24000,
      leaseStart: new Date("2026-04-01"),
      leaseEnd: new Date("2027-02-28"),
      status: "ACTIVE",
      elecPrev: 140,
      elecCurr: 215,
      waterPrev: 18,
      waterCurr: 25,
      paymentMonth: "October, 2026",
      paymentStatus: "PAID",
      paidOn: new Date("2026-10-05"),
    },
    {
      name: "Neha Gupta",
      mobile: "9828077889",
      email: "neha.gupta@gmail.com",
      unit: unitS02,
      property: propB,
      monthlyRent: 8500,
      deposit: 17000,
      leaseStart: new Date("2026-05-01"),
      leaseEnd: new Date("2027-03-31"),
      status: "ACTIVE",
      elecPrev: 310,
      elecCurr: 380,
      waterPrev: 22,
      waterCurr: 30,
      paymentMonth: "October, 2026",
      paymentStatus: "PENDING",
      paidOn: null,
      hasMaintenance: true,
      maintenanceTitle: "Ceiling Fan Regulator Sparking",
      maintenanceDesc: "Bedroom fan speed regulator is sparking when turned to speed 3. Electrician inspection requested.",
      maintenanceCategory: "ELECTRICAL",
      maintenancePriority: "MEDIUM",
    },
  ];

  for (const u of usersData) {
    // A. User Account
    const tenantUser = await prisma.user.upsert({
      where: { mobile: u.mobile },
      update: { name: u.name, email: u.email },
      create: {
        mobile: u.mobile,
        name: u.name,
        email: u.email,
        status: "ACTIVE",
      },
    });

    // B. Tenant Record
    const tenantRecord = await prisma.tenant.create({
      data: {
        name: u.name,
        email: u.email,
        phone: u.mobile,
        propertyId: u.property.id,
        leaseStart: u.leaseStart.toISOString().slice(0, 10),
        leaseEnd: u.leaseEnd.toISOString().slice(0, 10),
        createdById: admin.id,
      },
    });

    // C. Active Lease Contract with Rent Rule & Schedules
    const lease = await prisma.lease.create({
      data: {
        propertyId: u.property.id,
        unitId: u.unit.id,
        tenantId: tenantUser.id,
        monthlyRent: u.monthlyRent,
        securityDeposit: u.deposit,
        startDate: u.leaseStart,
        endDate: u.leaseEnd,
        status: u.status,
        rentRule: {
          create: {
            dueDay: 5,
            graceDays: 3,
            penaltyType: "PER_DAY",
            penaltyAmount: 100,
            maxPenaltyCap: 2000,
          },
        },
      },
    });

    // D. Generate Rent Schedule for Current Month (October 2026)
    await prisma.rentSchedule.create({
      data: {
        leaseId: lease.id,
        period: "October 2026",
        dueDate: new Date(2026, 9, 5, 12, 0, 0),
        amount: u.monthlyRent,
        paidAmount: u.paymentStatus === "PAID" ? u.monthlyRent : 0,
        penaltyAmount: u.paymentStatus === "OVERDUE" ? 200 : 0,
        status:
          u.paymentStatus === "PAID"
            ? "PAID"
            : u.paymentStatus === "OVERDUE"
            ? "OVERDUE"
            : "DUE",
        paidOn: u.paidOn,
      },
    });

    // E. Sub-Meter Readings (Electricity & Water)
    const elecConsumed = u.elecCurr - u.elecPrev;
    const elecAmount = elecConsumed * 9.0;
    await prisma.meterReading.create({
      data: {
        unitId: u.unit.id,
        utilityType: "ELECTRICITY",
        readingMonth: "2026-10",
        previousReading: u.elecPrev,
        currentReading: u.elecCurr,
        consumedUnits: elecConsumed,
        ratePerUnit: 9.0,
        amount: elecAmount,
        status: "BILLED",
        notes: "Monthly physical meter inspection",
      },
    });

    const waterConsumed = u.waterCurr - u.waterPrev;
    const waterAmount = waterConsumed * 20.0;
    await prisma.meterReading.create({
      data: {
        unitId: u.unit.id,
        utilityType: "WATER",
        readingMonth: "2026-10",
        previousReading: u.waterPrev,
        currentReading: u.waterCurr,
        consumedUnits: waterConsumed,
        ratePerUnit: 20.0,
        amount: waterAmount,
        status: "BILLED",
        notes: "Water meter monthly reading",
      },
    });

    // F. Total Payment Ledger Record (Rent + Sub-meter Utilities)
    const totalBillAmount = u.monthlyRent + elecAmount + waterAmount;
    await prisma.payment.create({
      data: {
        tenantId: tenantRecord.id,
        propertyId: u.property.id,
        amount: totalBillAmount,
        month: u.paymentMonth,
        status: u.paymentStatus,
        paidOn: u.paidOn,
        createdById: admin.id,
      },
    });

    // G. Maintenance Complaints (if any)
    if (u.hasMaintenance) {
      await prisma.maintenanceRequest.create({
        data: {
          propertyId: u.property.id,
          unitId: u.unit.id,
          tenantId: tenantUser.id,
          title: u.maintenanceTitle,
          description: u.maintenanceDesc,
          category: u.maintenanceCategory,
          priority: u.maintenancePriority,
          status: "OPEN",
          cost: 0,
        },
      });
    }

    console.log(
      `✓ Configured User: ${u.name} | Unit: ${u.unit.unitNumber} (${u.property.title}) | Rent: ₹${u.monthlyRent} | Bill: ₹${totalBillAmount} (${u.paymentStatus})`
    );
  }

  console.log("--------------------------------------------------");
  console.log("ALL 5 USERS AND REAL-WORLD DATA SETUP COMPLETE!");
  console.log("Admin Bharat (8003953815) now owns 2 Properties, 5 Units, 5 Leases, and Live Ledgers.");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("Error setting up real data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
