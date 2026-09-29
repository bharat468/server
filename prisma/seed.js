import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo owner
  const owner = await prisma.user.upsert({
    where: { mobile: '9876543210' },
    update: {},
    create: {
      mobile: '9876543210',
      email: 'bharat@rentmate.local',
      name: 'Bharat',
      status: 'ACTIVE',
    },
  });

  console.log(`Demo Owner created: ${owner.name} (${owner.mobile})`);

  // Create demo organization
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

  console.log(`Demo Organization created: ${organization.name}`);
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
