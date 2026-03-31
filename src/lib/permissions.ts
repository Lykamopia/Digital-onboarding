
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
    // Customer Onboarding (Maker-Checker Operations)
    { id: 'submit_customer_onboarding', label: 'Maker (Legacy Submission)', description: 'Can submit new customer onboarding requests.' },
    { id: 'review_customer_onboarding', label: 'Checker (Legacy Review)', description: 'Can approve or reject onboarding requests.' },
    { id: 'maker_customer_onboarding', label: 'Maker (Onboarding)', description: 'Primary Maker role for customer onboarding submissions.' },
    { id: 'checker_customer_onboarding', label: 'Checker (Onboarding)', description: 'Primary Checker role for customer onboarding review and approval.' },
];


