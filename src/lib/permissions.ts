
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
    { id: 'manage_memos', label: 'Manage Memos', description: 'Can create and manage memos.' },
    { id: 'manage_general_settings', label: 'General Settings', description: 'Can manage platform global settings.' },
    { id: 'manage_email_settings', label: 'Email Settings', description: 'Can manage SMTP and email templates.' },
    { id: 'manage_labels', label: 'Manage Labels', description: 'Can create and edit system labels.' },
    { id: 'manage_audit_log', label: 'Audit Logs', description: 'Can view administrative audit logs.' },
    { id: 'manage_archive', label: 'Manage Archive', description: 'Can view and restore archived items.' },
    // Customer Onboarding (Maker-Checker Operations)
    { id: 'maker_customer_onboarding', label: 'Maker (Onboarding)', description: 'Primary Maker role for customer onboarding submissions.' },
    { id: 'checker_customer_onboarding', label: 'Checker (Onboarding)', description: 'Primary Checker role for customer onboarding review and approval.' },
];


