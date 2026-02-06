
import type { Permission } from '@/lib/types';

export const permissions: { id: Permission, label: string, description: string }[] = [
    { id: 'view_dashboard', label: 'View Dashboard', description: 'Can view memo folders like Inbox, Sent, Favorites, and Archive.' },
    { id: 'manage_memos', label: 'Manage Memos', description: 'Can create, edit, and send new memos and drafts.' },
    { id: 'manage_general_settings', label: 'Manage General Settings', description: 'Can manage general application settings' },
    { id: 'manage_email_settings', label: 'Manage Email Settings', description: 'Can manage email notification settings' },
    { id: 'manage_divisions', label: 'Manage Divisions', description: 'Can create, edit, and delete divisions' },
    { id: 'manage_departments', label: 'Manage Departments', description: 'Can create, edit, and delete departments' },
    { id: 'manage_branches', label: 'Manage Branches', description: 'Can create, edit, and delete branches' },
    { id: 'manage_districts', label: 'Manage Districts', description: 'Can create, edit, and delete districts' },
    { id: 'manage_offices', label: 'Manage Offices', description: 'Can create, edit, and delete offices' },
    { id: 'manage_users', label: 'Manage Users', description: 'Can create, edit, and delete users' },
    { id: 'manage_roles', label: 'Manage Roles', description: 'Can create, edit, and manage roles and permissions' },
    { id: 'manage_archive', label: 'Manage Archive', description: 'Can manage archive settings and permanently delete memos' },
    { id: 'manage_audit_log', label: 'Manage Audit Log', description: 'Can view the full audit trail of all memos' },
    { id: 'manage_labels', label: 'Manage Labels', description: 'Can create, edit, and delete memo labels' },
];


export const delegationPermissions = [
  { id: 'delegation:view', label: 'View Memos', description: "Can view the delegator's inbox, sent items, and archive." },
  { id: 'delegation:draft', label: 'Draft Memos', description: "Can create and save drafts on behalf of the delegator." },
  { id: 'delegation:send', label: 'Send Memos', description: "Can send new memos and drafts. The 'From' field will show the delegator." },
  { id: 'delegation:reply', label: 'Reply & Assign', description: "Can reply to or assign memos received by the delegator." },
  { id: 'delegation:acknowledge', label: 'Acknowledge Memos', description: "Can acknowledge memos on behalf of the delegator." },
] as const;
