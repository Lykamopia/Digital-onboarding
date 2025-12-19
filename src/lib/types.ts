export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  division: string;
  department: string;
  office: string;
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
  action: 'created' | 'sent' | 'viewed' | 'acknowledged' | 'commented' | 'delegated';
  timestamp: string;
  details?: string;
};

export type MemoWithActivity = Memo & {
  activity: Activity[];
};
