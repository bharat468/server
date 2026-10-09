import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('RENTMATE End-to-End BRD/TRD Lifecycle Integration Tests', () => {
  let landlordUser;
  let tenantUser;
  let landlordToken;
  let tenantToken;
  let property;
  let unit;
  let listing;
  let application;
  let leaseId;
  let scheduleId;
  let maintenanceId;

  beforeAll(async () => {
    // 1. Setup Landlord User
    landlordUser = await prisma.user.upsert({
      where: { mobile: '9111122222' },
      update: {},
      create: {
        mobile: '9111122222',
        name: 'Landlord Lifecycle Test',
        email: 'landlord_lifecycle@rentmate.local',
        status: 'ACTIVE',
      },
    });

    landlordToken = jwt.sign(
      { id: landlordUser.id, mobile: landlordUser.mobile, status: landlordUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Setup Tenant User
    tenantUser = await prisma.user.upsert({
      where: { mobile: '9333344444' },
      update: {},
      create: {
        mobile: '9333344444',
        name: 'Tenant Lifecycle Test',
        email: 'tenant_lifecycle@rentmate.local',
        status: 'ACTIVE',
      },
    });

    tenantToken = jwt.sign(
      { id: tenantUser.id, mobile: tenantUser.mobile, status: tenantUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 3. Create a Test Property
    property = await prisma.property.create({
      data: {
        title: 'Sunset Heights Residency',
        address: '100 Marine Drive',
        city: 'Mumbai',
        rent: 25000,
        bedrooms: 2,
        status: 'VACANT',
        ownerId: landlordUser.id,
        createdById: landlordUser.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created records
    if (property) {
      await prisma.maintenanceRequest.deleteMany({ where: { propertyId: property.id } });
      await prisma.rentSchedule.deleteMany({ where: { lease: { propertyId: property.id } } });
      await prisma.rentRule.deleteMany({ where: { lease: { propertyId: property.id } } });
      await prisma.lease.deleteMany({ where: { propertyId: property.id } });
      await prisma.rentalApplication.deleteMany({ where: { listing: { propertyId: property.id } } });
      await prisma.rentalListing.deleteMany({ where: { propertyId: property.id } });
      await prisma.unit.deleteMany({ where: { propertyId: property.id } });
      await prisma.property.deleteMany({ where: { id: property.id } });
    }
    await prisma.$disconnect();
  });

  // Step 1: Unit Management
  it('Step 1: Should create a unit under the property', async () => {
    const res = await request(app)
      .post('/api/v1/units')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        propertyId: property.id,
        unitNumber: 'A-201',
        floor: 2,
        type: 'FLAT_2BHK',
        areaSqFt: 950,
        rentAmount: 28000,
        depositAmount: 56000,
        furnishing: 'SEMI_FURNISHED',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unitNumber).toBe('A-201');
    expect(res.body.data.status).toBe('VACANT');
    unit = res.body.data;
  });

  // Step 2: Listing & Marketplace
  it('Step 2: Should publish a rental listing for the unit', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        unitId: unit.id,
        title: 'Luxury 2BHK Sea-Facing Flat in Marine Drive',
        description: 'Spacious flat with modular kitchen and balcony.',
        category: 'RESIDENTIAL',
        monthlyRent: 28000,
        securityDeposit: 56000,
        furnishing: 'SEMI_FURNISHED',
        amenities: ['Gym', 'Elevator', 'Covered Parking', 'Security Guard'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PUBLISHED');
    listing = res.body.data;
  });

  it('Step 3: Public marketplace endpoint should return the published listing', async () => {
    const res = await request(app).get('/api/v1/listings/public?city=Mumbai');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((l) => l.id === listing.id);
    expect(found).toBeDefined();
    expect(found.title).toContain('Luxury 2BHK');
  });

  // Step 4: Rental Application
  it('Step 4: Tenant should apply for the listing', async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        listingId: listing.id,
        name: 'Tenant Lifecycle Test',
        occupation: 'Software Engineer',
        message: 'Looking to move in starting 1st of next month.',
        proposedMoveIn: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    application = res.body.data;
  });

  // Step 5: Application Approval + Lease Activation Transaction
  it('Step 5: Owner should approve application and trigger Lease + Rent Schedules creation', async () => {
    const res = await request(app)
      .post(`/api/v1/applications/${application.id}/approve`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        rentRule: {
          dueDay: 5,
          graceDays: 2,
          penaltyType: 'PER_DAY',
          penaltyAmount: 150,
          maxPenaltyCap: 3000,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lease).toBeDefined();
    expect(res.body.data.lease.status).toBe('ACTIVE');
    expect(res.body.data.schedules.length).toBeGreaterThan(0);

    leaseId = res.body.data.lease.id;
    scheduleId = res.body.data.schedules[0].id;
  });

  // Step 6: Tenant "My Rentals" Portal View
  it('Step 6: Tenant should see their active rental in /my-rentals', async () => {
    const res = await request(app)
      .get('/api/v1/leases/my-rentals')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const myLease = res.body.data.find((l) => l.id === leaseId);
    expect(myLease).toBeDefined();
    expect(myLease.unit.unitNumber).toBe('A-201');
    expect(myLease.rentRule.penaltyAmount).toBe(150);
  });

  // Step 7: Rent Schedule Payment
  it('Step 7: Tenant should record payment against rent schedule', async () => {
    const currentSchedule = await prisma.rentSchedule.findUnique({ where: { id: scheduleId } });
    const fullAmountToPay = currentSchedule.amount + currentSchedule.penaltyAmount;

    const res = await request(app)
      .post(`/api/v1/leases/schedules/${scheduleId}/pay`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        amount: fullAmountToPay,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.paidAmount).toBe(fullAmountToPay);
  });

  // Step 8: Maintenance Ticket Lifecycle
  it('Step 8: Tenant should raise a maintenance request', async () => {
    const res = await request(app)
      .post('/api/v1/maintenance')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId: property.id,
        unitId: unit.id,
        title: 'Master Bathroom Geyser Not Working',
        description: 'Water heating element tripped MCB switch.',
        category: 'ELECTRICAL',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('OPEN');
    maintenanceId = res.body.data.id;
  });

  it('Step 9: Owner should update maintenance ticket status to RESOLVED with cost', async () => {
    const res = await request(app)
      .patch(`/api/v1/maintenance/${maintenanceId}/status`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        status: 'RESOLVED',
        cost: 650,
        notes: 'Electrician replaced the thermostat switch.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.cost).toBe(650);
  });
});
