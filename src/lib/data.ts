import type { User, MemoWithActivity, Division, Department, Office } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format, formatDistanceToNow } from 'date-fns';

const userImages = PlaceHolderImages.reduce((acc, img) => {
  acc[img.id] = img.imageUrl;
  return acc;
}, {} as Record<string, string>);

export const divisions: Division[] = [
  { id: 'div-1', name: 'Retail Banking', code: 'RB' },
  { id: 'div-2', name: 'Corporate Banking', code: 'CB' },
  { id: 'div-3', name: 'Investment Banking', code: 'IB' },
  { id: 'div-4', name: 'Information Technology', code: 'IT' },
];

export const departments: Department[] = [
  { id: 'dept-1', name: 'Client Services', code: 'CS', divisionId: 'div-1' },
  { id: 'dept-2', name: 'Operations', code: 'OPS', divisionId: 'div-1' },
  { id: 'dept-3', name: 'Loan Origination', code: 'LO', divisionId: 'div-2' },
  { id: 'dept-4', name: 'Mergers & Acquisitions', code: 'MA', divisionId: 'div-3' },
  { id: 'dept-5', name: 'Infrastructure', code: 'INFRA', divisionId: 'div-4' },
];

export const offices: Office[] = [
    { id: 'off-1', name: 'Main Branch', code: 'MB', departmentId: 'dept-1' },
    { id: 'off-2', name: 'North Branch', code: 'NB', departmentId: 'dept-2' },
    { id: 'off-3', name: 'Headquarters', code: 'HQ', departmentId: 'dept-3' },
    { id: 'off-4', name: 'Headquarters', code: 'HQ', departmentId: 'dept-4' },
    { id: 'off-5', name: 'Data Center', code: 'DC', departmentId: 'dept-5' },
];

export const users: User[] = [
  { id: 'user-1', name: 'Alice Johnson', email: 'alice.j@bank.com', avatar: userImages['user-1'] || '', officeId: 'off-1', division: 'Retail Banking', department: 'Client Services', office: 'Main Branch' },
  { id: 'user-2', name: 'Bob Williams', email: 'bob.w@bank.com', avatar: userImages['user-2'] || '', officeId: 'off-3', division: 'Corporate Banking', department: 'Loan Origination', office: 'Headquarters' },
  { id: 'user-3', name: 'Charlie Brown', email: 'charlie.b@bank.com', avatar: userImages['user-3'] || '', officeId: 'off-4', division: 'Investment Banking', department: 'Mergers & Acquisitions', office: 'Headquarters' },
  { id: 'user-4', name: 'Diana Prince', email: 'diana.p@bank.com', avatar: userImages['user-4'] || '', officeId: 'off-2', division: 'Retail Banking', department: 'Operations', office: 'North Branch' },
  { id: 'user-5', name: 'Ethan Hunt', email: 'ethan.h@bank.com', avatar: userImages['user-5'] || '', officeId: 'off-5', division: 'IT', department: 'Infrastructure', office: 'Data Center' },
];

export const loggedInUser = users[0];

export const memos: MemoWithActivity[] = [
  {
    id: 'memo-1',
    memo_reference_number: "MEMO-2024-001",
    from: users[1],
    to: [users[0], users[2]],
    cc: [users[3]],
    subject: 'Q3 Financial Report Review',
    body: '<p>Please review the attached Q3 financial report and provide your feedback by EOD Friday.</p><p>We need to finalize this for the board meeting next week.</p>',
    attachments: [{ id: 'att-1', name: 'Q3_Financials.pdf', size: '2.5 MB', url: '#' }],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'read',
    current_holder: users[0],
    previous_holders: [],
    activity: [
      { id: 'act-1-1', actor: users[1], action: 'sent', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), details: `Sent to ${users[0].name}, ${users[2].name}. CC: ${users[3].name}` },
      { id: 'act-1-2', actor: users[0], action: 'viewed', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
      { id: 'act-1-3', actor: users[2], action: 'viewed', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'memo-2',
    memo_reference_number: "MEMO-2024-002",
    from: users[3],
    to: [users[0]],
    cc: [],
    subject: 'New Security Protocol Implementation',
    body: '<p>Team,</p><p>We will be rolling out a new security protocol starting next Monday. Please ensure all your team members complete the mandatory training module by then. See attached document for details.</p><p>Thank you.</p>',
    attachments: [{ id: 'att-2', name: 'Security_Protocol_v2.docx', size: '780 KB', url: '#' }],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'acknowledged',
    current_holder: users[0],
    previous_holders: [],
    activity: [
      { id: 'act-2-1', actor: users[3], action: 'sent', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), details: `Sent to ${users[0].name}.` },
      { id: 'act-2-2', actor: users[0], action: 'viewed', timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString() },
      { id: 'act-2-3', actor: users[0], action: 'acknowledged', timestamp: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'memo-3',
    memo_reference_number: "MEMO-2024-003",
    from: users[0],
    to: [users[4]],
    cc: [users[1]],
    subject: 'IT Maintenance Schedule for November',
    body: '<p>Hi Ethan, please find the proposed IT maintenance schedule for November. Let me know if your team foresees any conflicts.</p>',
    attachments: [],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    current_holder: users[4],
    previous_holders: [],
     activity: [
       { id: 'act-3-1', actor: users[0], action: 'sent', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), details: `Sent to ${users[4].name}. CC: ${users[1].name}` },
    ],
  },
  {
    id: 'memo-4',
    memo_reference_number: "MEMO-2024-004",
    from: users[2],
    to: [users[0], users[1], users[3], users[4]],
    cc: [],
    subject: 'Upcoming All-Hands Meeting',
    body: '<p>A reminder that our quarterly all-hands meeting is scheduled for this Thursday at 10:00 AM in the main auditorium. Please add it to your calendars.</p><p>An agenda will be sent out shortly.</p>',
    attachments: [],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    current_holder: users[1],
    previous_holders: [users[0]],
     activity: [
      { id: 'act-4-1', actor: users[2], action: 'sent', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), details: 'Sent to Alice Johnson, Bob Williams, Diana Prince, Ethan Hunt.' },
      { id: 'act-4-2', actor: users[0], action: 'viewed', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'act-4-3', actor: users[0], action: 'forwarded', details: 'Forwarded from Alice Johnson to Bob Williams.\n<b>Remark:</b> Bob, can you handle this?', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10000).toISOString() },
      { id: 'act-4-4', actor: users[1], action: 'commented', details: 'Will there be a remote option?', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
];

export const formatTimestamp = (timestamp: string, relative: boolean = true) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return '';
    }
    const formattedDate = format(date, "MMMM d, yyyy 'at' h:mm a");
    if (!relative) return format(date, "MMMM d, yyyy");
    
    const relativeDate = formatDistanceToNow(date, { addSuffix: true });
    return `${formattedDate} (${relativeDate})`;
  } catch (e) {
    return '';
  }
};
