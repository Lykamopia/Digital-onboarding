
export type Role = 'Admin' | 'Member';

export type Division = {
  id: string;
  name: string;
  code: string;
};

export type Department = {
  id: string;
  name: string;
  code: string;
  divisionId: string;
};

export type Office = {
  id: string;
  name: string;
  code: string;
  departmentId: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  officeId: string;
  division: string; // denormalized for convenience
  department: string; // denormalized for convenience
  office: string; // denormalized for convenience
  role: Role;
};

export type Attachment = {
  id: string;
  name: string;
  size: number; // size in bytes
  type: string; // mime type
  url: string; // data URL for preview and storage
};

export type Memo = {
  id:string;
  memo_reference_number: string;
  from: User;
  to: User[];
  cc: User[];
  subject: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
  status: 'draft' | 'sent' | 'read' | 'acknowledged' | 'archived';
  current_holder?: User;
  previous_holders?: User[];
  archivedBy?: string[]; // Array of user IDs who have archived this memo
  acknowledgedBy?: string[]; // Array of user IDs who have acknowledged this memo
  replyTo?: string; // ID of the memo this is a reply to
};

export type Activity = {
  id: string;
  actor: User;
  action: 'created' | 'sent' | 'viewed' | 'acknowledged' | 'commented' | 'forwarded' | 'archived' | 'unarchived' | 'replied';
  timestamp: string;
  details?: string;
};

export type MemoWithActivity = Memo & {
  activity: Activity[];
};

    