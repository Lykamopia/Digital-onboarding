
import type { Permission } from '@/lib/types';

export const permissions: { id: Permission, label: string, description: string }[] = [
    { id: 'manage_divisions', label: 'Manage Divisions', description: 'Can create, edit, and delete divisions' },
    { id: 'manage_departments', label: 'Manage Departments', description: 'Can create, edit, and delete departments' },
    { id: 'manage_branches', label: 'Manage Branches', description: 'Can create, edit, and delete branches' },
    { id: 'manage_districts', label: 'Manage Districts', description: 'Can create, edit, and delete districts' },
    { id: 'manage_offices', label: 'Manage Offices', description: 'Can create, edit, and delete offices' },
    { id: 'manage_users', label: 'Manage Users', description: 'Can create, edit, and delete users' },
    { id: 'manage_roles', label: 'Manage Roles', description: 'Can create, edit, and manage roles and permissions' },
    { id: 'manage_security_logs', label: 'View Security Logs', description: 'Can view security-related event logs.' },
    // Customer Onboarding (Verifier-Approver Operations)
    { id: 'verifier_customer_onboarding', label: 'Verifier (Onboarding)', description: 'Primary Verifier role for customer onboarding reviews (Stage 1).' },
    { id: 'approver_customer_onboarding', label: 'Approver (Onboarding)', description: 'Primary Approver role for customer onboarding final authorization (Stage 2).' },
    { id: 'viewer_customer_onboarding', label: 'Viewer (Onboarding)', description: 'Read-only access to customer onboarding data and status (No actions).' },
];


