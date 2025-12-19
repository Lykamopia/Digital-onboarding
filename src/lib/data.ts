import type { User, MemoWithActivity } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format, formatDistanceToNow } from 'date-fns';

const userImages = PlaceHolderImages.reduce((acc, img) => {
  acc[img.id] = img.imageUrl;
  return acc;
}, {} as Record<string, string>);

export const users: User[] = [
  { id: 'user-1', name: 'Alice Johnson', email: 'alice.j@bank.com', avatar: userImages['user-1'] || '', division: 'Retail Banking', department: 'Client Services', office: 'Main Branch' },
  { id: 'user-2', name: 'Bob Williams', email: 'bob.w@bank.com', avatar: userImages['user-2'] || '', division: 'Corporate Banking', department: 'Loan Origination', office: 'Headquarters' },
  { id: 'user-3', name: 'Charlie Brown', email: 'charlie.b@bank.com', avatar: userImages['user-3'] || '', division: 'Investment Banking', department: 'Mergers & Acquisitions', office: 'Headquarters' },
  { id: 'user-4', name: 'Diana Prince', email: 'diana.p@bank.com', avatar: userImages['user-4'] || '', division: 'Retail Banking', department: 'Operations', office: 'North Branch' },
  { id: 'user-5', name: 'Ethan Hunt', email: 'ethan.h@bank.com', avatar: userImages['user-5'] || '', division: 'IT', department: 'Infrastructure', office: 'Data Center' },
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
      { id: 'act-4-3', actor: users[0], action: 'delegated', details: 'Delegated from Alice Johnson to Bob Williams.\n<b>Remark:</b> Bob, can you handle this?', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10000).toISOString() },
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
