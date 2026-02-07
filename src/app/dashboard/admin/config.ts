
import {
  Settings,
  Users,
  ShieldCheck,
  Building,
  Network,
  Store,
  MapPin,
  Briefcase,
  Tags,
  Archive,
  ScrollText,
  ShieldAlert,
  Mail,
} from 'lucide-react';
import React from 'react';

export type NavItemConfig = {
  value: string;
  label: string;
  permission: string;
  icon: React.ReactNode;
};

export const navItemsConfig: NavItemConfig[] = [
  // Core Settings
  { value: '/dashboard/admin/general', label: 'General', permission: 'manage_general_settings', icon: <Settings /> },
  { value: '/dashboard/admin/security', label: 'Security', permission: 'manage_security_logs', icon: <ShieldAlert /> },
  
  // User & Access Management
  { value: '/dashboard/admin/users', label: 'Users', permission: 'manage_users', icon: <Users /> },
  { value: '/dashboard/admin/roles', label: 'Roles', permission: 'manage_roles', icon: <ShieldCheck /> },

  // Organizational Structure
  { value: '/dashboard/admin/offices', label: 'Offices', permission: 'manage_offices', icon: <Briefcase /> },
  { value: '/dashboard/admin/departments', label: 'Departments', permission: 'manage_departments', icon: <Building /> },
  { value: '/dashboard/admin/divisions', label: 'Divisions', permission: 'manage_divisions', icon: <Network /> },
  { value: '/dashboard/admin/districts', label: 'Districts', permission: 'manage_districts', icon: <MapPin /> },
  { value: '/dashboard/admin/branches', label: 'Branches', permission: 'manage_branches', icon: <Store /> },

  // Memo Configuration
  { value: '/dashboard/admin/labels', label: 'Labels', permission: 'manage_labels', icon: <Tags /> },
  { value: '/dashboard/admin/email', label: 'Email', permission: 'manage_email_settings', icon: <Mail /> },
  
  // System Maintenance
  { value: '/dashboard/admin/audit', label: 'Audit', permission: 'manage_audit_log', icon: <ScrollText /> },
  { value: '/dashboard/admin/archive', label: 'Archive', permission: 'manage_archive', icon: <Archive /> },
];
