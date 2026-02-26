
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const offices = [
  { id: 'off-1', name: 'Head Office', code: 'HO', type: 'division_office' },
];

const roles = [
  {
    id: 'role-1',
    name: 'Admin',
    permissions: [
      'manage_memos',
      'manage_general_settings',
      'manage_email_settings',
      'manage_divisions',
      'manage_departments',
      'manage_branches',
      'manage_districts',
      'manage_offices',
      'manage_users',
      'manage_roles',
      'manage_archive',
      'manage_labels',
      'manage_audit_log',
      'manage_security_logs',
    ].join(','),
  },
  { id: 'role-2', name: 'Member', permissions: ['manage_memos'].join(',') },
];

const labels = [
    { id: 'label-1', name: 'Urgent', color: '#ef4444', type: 'SYSTEM' },
    { id: 'label-2', name: 'Confidential', color: '#8b5cf6', type: 'SYSTEM' },
    { id: 'label-3', name: 'Action Required', color: '#f97316', type: 'SYSTEM' },
    { id: 'label-4', name: 'For Review', color: '#3b82f6', type: 'SYSTEM' },
    { id: 'label-5', name: 'Delegation', color: '#f59e0b', type: 'SYSTEM' },
];

async function main() {
  console.log('Cleaning database for production deployment...');
  
  // Cleanup in reverse order of relations
  await prisma.activity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.memo.deleteMany();
  await prisma.delegation.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.label.deleteMany();
  await prisma.role.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.division.deleteMany();
  await prisma.district.deleteMany();
  await prisma.department.deleteMany();
  await prisma.office.deleteMany();
  
  console.log('Cleared all existing data.');

  // Seed essential structural data
  await prisma.office.createMany({ data: offices });
  console.log(`Seeded production-ready office structure.`);

  await prisma.role.createMany({ data: roles });
  console.log(`Seeded system roles.`);

  await prisma.label.createMany({ data: labels });
  console.log(`Seeded system labels.`);

  // Seed Primary Admin User from environment variables
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('CRITICAL: Please set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file before seeding for production.');
  }

  console.log(`Creating primary system administrator: ${adminEmail}...`);
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
      data: {
          id: 'user-admin',
          name: 'System Administrator',
          email: adminEmail,
          hashedPassword: hashedPassword,
          roleId: 'role-1',
          officeId: 'off-1',
          onboardingCompleted: true,
          status: 'active',
      }
  });
  
  console.log(`Primary Administrator "${adminUser.name}" created successfully.`);
  console.log('Production seeding finished. You can now log in and begin organizational setup.');
}

main()
  .catch((e) => {
    console.error('Error during production seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
