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
};

export type Attachment = {
  id: string;
  name: string;
  size: string;
  url: string;
};

export type Memo = {
  id: string;
  memo_reference_number: string;
  from: User;
  to: User[];
  cc: User[];
  subject: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
  status: 'draft' | 'sent' | 'read' | 'acknowledged';
  current_holder?: User;
  previous_holders?: User[];
};

export type Activity = {
  id: string;
  actor: User;
  action: 'created' | 'sent' | 'viewed' | 'acknowledged' | 'commented' | 'forwarded';
  timestamp: string;
  details?: string;
};

export type MemoWithActivity = Memo & {
  activity: Activity[];
};
