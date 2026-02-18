

import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const offices = [
  { id: 'off-1', name: 'Head Office', code: 'HO', type: 'division_office' },
  { id: 'off-2', name: 'City Branches', code: 'CB', type: 'branch_office' },
  { id: 'off-3', name: 'Regional Branches', code: 'RB', type: 'branch_office' },
];

const departments = [
  { id: 'dept-1', name: 'Retail Banking', code: 'RB', officeId: 'off-1' },
  { id: 'dept-2', name: 'Corporate Banking', code: 'CB', officeId: 'off-1' },
  { id: 'dept-3', name: 'Investment Banking', code: 'IB', officeId: 'off-1' },
  { id: 'dept-4', name: 'Information Technology', code: 'IT', officeId: 'off-1' },
];

const divisions = [
  { id: 'div-1', name: 'Client Services', code: 'CS', departmentId: 'dept-1', type: 'division' },
  { id: 'div-2', name: 'Operations', code: 'OPS', departmentId: 'dept-1', type: 'division' },
  { id: 'div-3', name: 'Loan Origination', code: 'LO', departmentId: 'dept-2', type: 'division' },
  { id: 'div-4', name: 'Mergers & Acquisitions', code: 'MA', departmentId: 'dept-3', type: 'division' },
  { id: 'div-5', name: 'Infrastructure', code: 'INFRA', departmentId: 'dept-4', type: 'division' },
];

const districts = [
    { id: 'dist-1', name: 'North Addis', code: 'NA', officeId: 'off-2' },
    { id: 'dist-2', name: 'South Addis', code: 'SA', officeId: 'off-2' },
    { id: 'dist-3', name: 'Adama', code: 'AD', officeId: 'off-3' },
];

const branches = [
  { id: 'branch-1', name: 'Bole', code: 'BOL', districtId: 'dist-1', type: 'branch' },
  { id: 'branch-2', name: 'Cazanches', code: 'CAZ', districtId: 'dist-1', type: 'branch' },
  { id: 'branch-3', name: 'Kirkos', code: 'KIR', districtId: 'dist-2', type: 'branch' },
  { id: 'branch-4', name: 'Adama Main', code: 'ADM', districtId: 'dist-3', type: 'branch' },
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
];

const users = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice.j@bank.com',
    avatar: 'https://images.unsplash.com/photo-1557053910-d9eadeed1c58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwyfHx3b21hbiUyMHBvcnRyYWl0fGVufDB8fHx8MTc2NjA3MDMzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-1',
    departmentId: 'dept-1',
    divisionId: 'div-1',
    roleId: 'role-2',
    status: 'pending',
  },
  {
    id: 'user-2',
    name: 'Bob Williams',
    email: 'bob.w@bank.com',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxtYW4lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjYwNTI3Njl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-1',
    departmentId: 'dept-4',
    divisionId: 'div-5',
    roleId: 'role-2',
    status: 'pending',
  },
  {
    id: 'user-3',
    name: 'Charlie Brown',
    email: 'charlie.b@bank.com',
    avatar: 'https://images.unsplash.com/photo-1590086782792-42dd2350140d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjYwODgyNTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-2',
    districtId: 'dist-1',
    branchId: 'branch-1',
    roleId: 'role-2',
    status: 'pending',
  },
  {
    id: 'user-4',
    name: 'Diana Prince',
    email: 'diana.p@bank.com',
    avatar: 'https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHjaHwyfHx3b21hbiUyMHBvcnRyYWl0fGVufDB8fHx8MTc2NjA3MDMzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-2',
    districtId: 'dist-1',
    branchId: 'branch-2',
    roleId: 'role-2',
    status: 'pending',
  },
  {
    id: 'user-5',
    name: 'Ethan Hunt',
    email: 'ethan.h@bank.com',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxtYW4lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjYwNTI3Njl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-1',
    departmentId: 'dept-1',
    divisionId: 'div-2',
    roleId: 'role-2',
    status: 'pending',
  },
  {
    id: 'user-6',
    name: 'Fiona Glenanne',
    email: 'fiona.g@bank.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHxfHx3b21hbiUyMHBvcnRyYWl0fGVufDB8fHx8MTc2NjA3MDMzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-2',
    districtId: 'dist-2',
    branchId: 'branch-3',
    roleId: 'role-2',
    status: 'pending',
  },
];

async function main() {
  console.log('Seeding database...');
  // Cleanup
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
  console.log('Cleared existing data.');

  // Seed data
  await prisma.office.createMany({ data: offices });
  console.log(`Seeded ${offices.length} offices.`);

  await prisma.department.createMany({ data: departments });
  console.log(`Seeded ${departments.length} departments.`);

  await prisma.division.createMany({ data: divisions.map(({type, ...rest}) => rest) });
  console.log(`Seeded ${divisions.length} divisions.`);
  
  await prisma.district.createMany({ data: districts });
  console.log(`Seeded ${districts.length} districts.`);

  await prisma.branch.createMany({ data: branches.map(({type, ...rest}) => rest) });
  console.log(`Seeded ${branches.length} branches.`);

  await prisma.role.createMany({ data: roles });
  console.log(`Seeded ${roles.length} roles.`);

  await prisma.label.createMany({ data: labels });
  console.log(`Seeded ${labels.length} labels.`);


  // Seed Admin User from .env
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('Please set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file');
  }

  console.log(`Seeding admin user: ${adminEmail}...`);
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.create({
      data: {
          id: 'user-admin',
          name: 'Admin User',
          email: adminEmail,
          hashedPassword: hashedPassword,
          roleId: 'role-1', // Assuming 'role-1' is the Admin role
          officeId: 'off-1', // Assign to a default office
          onboardingCompleted: true,
          status: 'active',
      }
  });
  console.log(`Admin user ${adminUser.name} created.`);

  // Seed other users without passwords (they must be invited by an admin)
  for (const user of users) {
      const { id, name, email, avatar, officeId, departmentId, divisionId, districtId, branchId, roleId, status } = user;
      await prisma.user.create({
          data: {
              id,
              name,
              email,
              avatar,
              officeId,
              departmentId: departmentId || null,
              divisionId: divisionId || null,
              districtId: districtId || null,
              branchId: branchId || null,
              roleId,
              hashedPassword: null,
              onboardingCompleted: false,
              status,
          }
      });
  }
  console.log(`Seeded ${users.length} other users.`);


  // Seed Memos (more complex due to relations)
  const memo1 = await prisma.memo.create({
    data: {
      id: 'memo-1',
      memo_reference_number: 'MEMO-2024-001',
      subject: 'Q3 Financial Report Review',
      body: '<p>Please review the attached Q3 financial report and provide your feedback by EOD Friday.</p><p>We need to finalize this for the board meeting next week.</p>',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'open',
      fromId: 'user-2',
      current_holderId: 'user-1',
      to: { connect: [{ id: 'user-1' }, { id: 'user-3' }] },
      cc: { connect: [{ id: 'user-4' }] },
      attachments: {
        create: [
          {
            id: 'att-1',
            name: 'Q3_Financials.pdf',
            size: 2621440,
            type: 'application/pdf',
            url: '#',
          },
        ],
      },
      activity: {
        create: [
          {
            id: 'act-1-1',
            actorId: 'user-2',
            action: 'sent',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            details: 'Sent to Alice Johnson, Charlie Brown. CC: Diana Prince',
            ipAddress: '203.0.113.1',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          {
            id: 'act-1-2',
            actorId: 'user-1',
            action: 'viewed',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            ipAddress: '198.51.100.25',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
          },
          {
            id: 'act-1-3',
            actorId: 'user-3',
            action: 'viewed',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            ipAddress: '192.0.2.88',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1'
          },
        ],
      },
      labels: {
          connect: [{ id: 'label-1' }, { id: 'label-4' }]
      }
    },
  });

  const memo2 = await prisma.memo.create({
    data: {
      id: 'memo-2',
      memo_reference_number: 'MEMO-2024-002',
      subject: 'New Security Protocol Implementation',
      body: '<p>Team,</p><p>We will be rolling out a new security protocol starting next Monday. Please ensure all your team members complete the mandatory training module by then. See attached document for details.</p><p>Thank you.</p>',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      fromId: 'user-4',
      current_holderId: 'user-4',
      to: { connect: [{ id: 'user-1' }] },
      acknowledgedBy: { connect: [{ id: 'user-1' }] },
      attachments: {
        create: [
          {
            id: 'att-2',
            name: 'Security_Protocol_v2.docx',
            size: 798720,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            url: '#',
          },
        ],
      },
      activity: {
        create: [
          {
            id: 'act-2-1',
            actorId: 'user-4',
            action: 'sent',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Sent to Alice Johnson.',
            ipAddress: '203.0.113.10',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          {
            id: 'act-2-2',
            actorId: 'user-1',
            action: 'viewed',
            timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
            ipAddress: '198.51.100.25',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
          },
          {
            id: 'act-2-3',
            actorId: 'user-1',
            action: 'acknowledged',
            timestamp: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
            ipAddress: '198.51.100.25',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
          },
        ],
      },
      labels: {
        connect: [{ id: 'label-2' }, { id: 'label-3' }]
      }
    },
  });

  const memo3 = await prisma.memo.create({
    data: {
      id: 'memo-3',
      memo_reference_number: 'MEMO-2024-003',
      subject: 'IT Maintenance Schedule for November',
      body: '<p>Hi Ethan, please find the proposed IT maintenance schedule for November. Let me know if your team foresees any conflicts.</p>',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open',
      fromId: adminUser.id,
      current_holderId: 'user-5',
      to: { connect: [{ id: 'user-5' }] },
      cc: { connect: [{ id: 'user-2' }] },
      activity: {
        create: [
          {
            id: 'act-3-1',
            actorId: adminUser.id,
            action: 'sent',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Sent to Ethan Hunt. CC: Bob Williams',
            ipAddress: '203.0.113.15',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
        ],
      },
    },
  });

  const memo4 = await prisma.memo.create({
    data: {
      id: 'memo-4',
      memo_reference_number: 'MEMO-2024-004',
      subject: 'Upcoming All-Hands Meeting',
      body: '<p>A reminder that our quarterly all-hands meeting is scheduled for this Thursday at 10:00 AM in the main auditorium. Please add it to your calendars.</p><p>An agenda will be sent out shortly.</p>',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'closed',
      fromId: 'user-3',
      current_holderId: 'user-2',
      to: {
        connect: [
          { id: adminUser.id },
          { id: 'user-2' },
          { id: 'user-4' },
          { id: 'user-5' },
        ],
      },
      previous_holders: { connect: [{ id: adminUser.id }] },
      activity: {
        create: [
          {
            id: 'act-4-1',
            actorId: 'user-3',
            action: 'sent',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            details: 'Sent to Alice Johnson, Bob Williams, Diana Prince, Ethan Hunt.',
            ipAddress: '192.0.2.88',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1'
          },
          {
            id: 'act-4-2',
            actorId: adminUser.id,
            action: 'viewed',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            ipAddress: '203.0.113.15',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          {
            id: 'act-4-3',
            actorId: adminUser.id,
            action: 'forwarded',
            details: `Forwarded from ${adminUser.name} to Bob Williams.\n<b>Remark:</b> Bob, can you handle this?`,
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10000).toISOString(),
            ipAddress: '203.0.113.15',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          {
            id: 'act-4-4',
            actorId: 'user-2',
            action: 'commented',
            details: 'Will there be a remote option?',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            ipAddress: '198.51.100.12',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
          },
        ],
      },
    },
  });
  console.log(`Seeded 4 memos with their relations.`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
