import { userService } from '../src/modules/users/user.service.js';
import { prisma } from '../src/config/database.config.js';

describe('User Module & Database Integration', () => {
  const testMobile = '9999988888';
  let createdUserId;

  afterAll(async () => {
    // Cleanup test user
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('successfully creates a user in PostgreSQL via UserService', async () => {
    // Delete if leftover
    await prisma.user.deleteMany({ where: { mobile: testMobile } });

    const user = await userService.createUser({
      mobile: testMobile,
      email: 'testuser@rentmate.local',
      name: 'Test Tenant',
    });

    createdUserId = user.id;

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.mobile).toBe(testMobile);
    expect(user.status).toBe('ACTIVE');
  });

  test('finds user by id with relationships included', async () => {
    const user = await userService.getUserById(createdUserId);

    expect(user).toBeDefined();
    expect(user.id).toBe(createdUserId);
    expect(user.name).toBe('Test Tenant');
  });

  test('prevents creating duplicate user with same mobile', async () => {
    await expect(
      userService.createUser({
        mobile: testMobile,
        name: 'Another Duplicate',
      })
    ).rejects.toThrow('already exists');
  });
});
