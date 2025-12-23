
import type { Permission } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';

export const permissions: { id: Permission, label: string, description: string }[] = [
    { id: 'view-dashboard', label: 'View Dashboard', description: 'Can view the main dashboard and memos' },
    { id: 'manage-memos', label: 'Manage Memos', description: 'Can create, edit, and send memos' },
    { id: 'view-admin', label: 'View Admin Section', description: 'Can access the admin section' },
    { id: 'manage-divisions', label: 'Manage Divisions', description: 'Can create, edit, and delete divisions' },
    { id: 'manage-departments', label: 'Manage Departments', description: 'Can create, edit, and delete departments' },
    { id: 'manage-offices', label: 'Manage Offices', description: 'Can create, edit, and delete offices' },
    { id: 'manage-users', label: 'Manage Users', description: 'Can create, edit, and delete users' },
    { id: 'manage-roles', label: 'Manage Roles', description: 'Can create, edit, and manage roles and permissions' },
];

export const formatTimestamp = (timestamp: string, relative: boolean = true) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return '';
    }
    const formattedDate = format(date, "MMMM d, yyyy 'at' h:mm a");
    if (!relative) return formattedDate;
    
    const relativeDate = formatDistanceToNow(date, { addSuffix: true });
    return `${formattedDate} (${relativeDate})`;
  } catch (e) {
    return '';
  }
};
