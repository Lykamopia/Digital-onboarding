
import { PrismaClient, Permission } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const divisions = [
  { id: 'div-1', name: 'Retail Banking', code: 'RB' },
  { id: 'div-2', name: 'Corporate Banking', code: 'CB' },
  { id: 'div-3', name: 'Investment Banking', code: 'IB' },
  { id: 'div-4', name: 'Information Technology', code: 'IT' },
];

const departments = [
  { id: 'dept-1', name: 'Client Services', code: 'CS', divisionId: 'div-1' },
  { id: 'dept-2', name: 'Operations', code: 'OPS', divisionId: 'div-1' },
  { id: 'dept-3', name: 'Loan Origination', code: 'LO', divisionId: 'div-2' },
  { id: 'dept-4', name: 'Mergers & Acquisitions', code: 'MA', divisionId: 'div-3' },
  { id: 'dept-5', name: 'Infrastructure', code: 'INFRA', divisionId: 'div-4' },
];

const offices = [
  { id: 'off-1', name: 'Main Branch', code: 'MB', departmentId: 'dept-1' },
  { id: 'off-2', name: 'North Branch', code: 'NB', departmentId: 'dept-2' },
  { id: 'off-3', name: 'Headquarters - CB', code: 'HQ-CB', departmentId: 'dept-3' },
  { id: 'off-4', name: 'Headquarters - IB', code: 'HQ-IB', departmentId: 'dept-4' },
  { id: 'off-5', name: 'Data Center', code: 'DC', departmentId: 'dept-5' },
];

const roles: { id: string; name: string; permissions: Permission[] }[] = [
  {
    id: 'role-1',
    name: 'Admin',
    permissions: [
      'view_dashboard',
      'manage_memos',
      'view_admin',
      'manage_divisions',
      'manage_departments',
      'manage_offices',
      'manage_users',
      'manage_roles',
      'manage_archive'
    ],
  },
  { id: 'role-2', name: 'Member', permissions: ['view_dashboard', 'manage_memos'] },
];

const users = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice.j@bank.com',
    avatar: 'https://images.unsplash.com/photo-1557053910-d9eadeed1c58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwyfHx3b21hbiUyMHBvcnRyYWl0fGVufDB8fHx8MTc2NjA3MDMzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-1',
    roleId: 'role-2',
  },
  {
    id: 'user-2',
    name: 'Bob Williams',
    email: 'bob.w@bank.com',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxtYW4lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjYwNTI3Njl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-3',
    roleId: 'role-2',
  },
  {
    id: 'user-3',
    name: 'Charlie Brown',
    email: 'charlie.b@bank.com',
    avatar: 'https://images.unsplash.com/photo-1590086782792-42dd2350140d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw0fHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjYwODgyNTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-4',
    roleId: 'role-2',
  },
  {
    id: 'user-4',
    name: 'Diana Prince',
    email: 'diana.p@bank.com',
    avatar: 'https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw2fHx3b21hbiUyMHBvcnRyYWl0fGVufDB8fHx8MTc2NjA3MDMzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-2',
    roleId: 'role-2',
  },
  {
    id: 'user-5',
    name: 'Ethan Hunt',
    email: 'ethan.h@bank.com',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxtYW4lMjBwb3J0cmFpdHxlbnwwfHx8fDE3NjYwNTI3Njl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    officeId: 'off-5',
    roleId: 'role-2',
  },
];

async function main() {
  console.log('Seeding database...');
  // Cleanup
  await prisma.activity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.memo.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.office.deleteMany();
  await prisma.department.deleteMany();
  await prisma.division.deleteMany();
  console.log('Cleared existing data.');

  // Seed data
  await prisma.division.createMany({ data: divisions });
  console.log(`Seeded ${divisions.length} divisions.`);

  await prisma.department.createMany({ data: departments });
  console.log(`Seeded ${departments.length} departments.`);

  await prisma.office.createMany({ data: offices });
  console.log(`Seeded ${offices.length} offices.`);

  await prisma.role.createMany({ data: roles });
  console.log(`Seeded ${roles.length} roles.`);

  // Seed Admin User
  const adminPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.create({
      data: {
          id: 'user-admin',
          name: 'Admin User',
          email: 'admin@example.com',
          hashedPassword: hashedPassword,
          roleId: 'role-1',
          officeId: 'off-1', // Assign to a default office
      }
  });
  console.log('Seeded admin user.');


  // Seed other users without passwords (they can't log in until one is set)
  await prisma.user.createMany({ data: users.map(u => ({...u, hashedPassword: ''})) });
  console.log(`Seeded ${users.length} users.`);


  // Seed Memos (more complex due to relations)
  const memo1 = await prisma.memo.create({
    data: {
      id: 'memo-1',
      memo_reference_number: 'MEMO-2024-001',
      subject: 'Q3 Financial Report Review',
      body: '<p>Please review the attached Q3 financial report and provide your feedback by EOD Friday.</p><p>We need to finalize this for the board meeting next week.</p>',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'read',
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
          },
          {
            id: 'act-1-2',
            actorId: 'user-1',
            action: 'viewed',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'act-1-3',
            actorId: 'user-3',
            action: 'viewed',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          },
        ],
      },
    },
  });

  const memo2 = await prisma.memo.create({
    data: {
      id: 'memo-2',
      memo_reference_number: 'MEMO-2024-002',
      subject: 'New Security Protocol Implementation',
      body: '<p>Team,</p><p>We will be rolling out a new security protocol starting next Monday. Please ensure all your team members complete the mandatory training module by then. See attached document for details.</p><p>Thank you.</p>',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'acknowledged',
      fromId: 'user-4',
      current_holderId: 'user-1',
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
          },
          {
            id: 'act-2-2',
            actorId: 'user-1',
            action: 'viewed',
            timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'act-2-3',
            actorId: 'user-1',
            action: 'acknowledged',
            timestamp: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
    },
  });

  const memo3 = await prisma.memo.create({
    data: {
      id: 'memo-3',
      memo_reference_number: 'MEMO-2024-003',
      subject: 'IT Maintenance Schedule for November',
      body: '<p>Hi Ethan, please find the proposed IT maintenance schedule for November. Let me know if your team foresees any conflicts.</p>',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'sent',
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
      status: 'sent',
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
          },
          {
            id: 'act-4-2',
            actorId: adminUser.id,
            action: 'viewed',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'act-4-3',
            actorId: adminUser.id,
            action: 'forwarded',
            details: `Forwarded from ${adminUser.name} to Bob Williams.\n<b>Remark:</b> Bob, can you handle this?`,
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10000).toISOString(),
          },
          {
            id: 'act-4-4',
            actorId: 'user-2',
            action: 'commented',
            details: 'Will there be a remote option?',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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

    