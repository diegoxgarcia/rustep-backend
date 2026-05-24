const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Seed sample rewards
  console.log('Seeding rewards...');

  const rewards = [
    {
      name: 'Premium Theme Pack',
      description: 'Unlock exclusive app themes and customization options',
      staminaCost: 500,
      category: 'cosmetic',
      isActive: true
    },
    {
      name: 'Weekly Challenge Badge',
      description: 'Exclusive badge for completing weekly challenges',
      staminaCost: 200,
      category: 'badge',
      isActive: true
    },
    {
      name: 'Custom Profile Frame',
      description: 'Stand out with a unique profile frame',
      staminaCost: 300,
      category: 'cosmetic',
      isActive: true
    },
    {
      name: 'Fitness Guide eBook',
      description: 'Digital guide with running tips and training plans',
      staminaCost: 1000,
      category: 'content',
      isActive: true
    },
    {
      name: 'Double XP Boost (24h)',
      description: 'Earn double stamina for 24 hours',
      staminaCost: 800,
      category: 'boost',
      isActive: true
    }
  ];

  for (const reward of rewards) {
    await prisma.reward.upsert({
      where: { name: reward.name },
      update: {},
      create: reward
    });
  }

  console.log(`Seeded ${rewards.length} rewards`);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
