import { Permission } from '@/lib/types';
import { format, formatDistanceToNow, differenceInYears, parse } from 'date-fns';

export const permissions: { id: Permission, label: string, description: string }[] = [
    { id: 'manage_divisions', label: 'Manage Divisions', description: 'Can create, edit, and delete divisions' },
    { id: 'manage_departments', label: 'Manage Departments', description: 'Can create, edit, and delete departments' },
    { id: 'manage_branches', label: 'Manage Branches', description: 'Can create, edit, and delete branches' },
    { id: 'manage_districts', label: 'Manage Districts', description: 'Can create, edit, and delete districts' },
    { id: 'manage_offices', label: 'Manage Offices', description: 'Can create, edit, and delete offices' },
    { id: 'manage_users', label: 'Manage Users', description: 'Can create, edit, and delete users' },
    { id: 'manage_roles', label: 'Manage Roles', description: 'Can create, edit, and manage roles and permissions' },
];

export const formatTimestamp = (timestamp: string | Date, relative: boolean = true) => {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
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

/**
 * Calculates age from a DOB string in format "DD MMM YYYY"
 */
export const calculateAge = (dobString: string | null | undefined): number | null => {
  if (!dobString) return null;
  try {
    // dobString format: "DD MMM YYYY" (e.g. "23 OCT 2000")
    const date = parse(dobString, "dd MMM yyyy", new Date());
    if (isNaN(date.getTime())) return null;
    return differenceInYears(new Date(), date);
  } catch (e) {
    return null;
  }
};

/**
 * Formats DOB string to include age: "23 OCT 2000 (25 years)"
 */
export const formatDOBWithAge = (dobString: string | null | undefined): string => {
  if (!dobString) return '';
  const age = calculateAge(dobString);
  if (age === null) return dobString;
  return `${dobString} (${age} year${age === 1 ? '' : 's'})`;
};
