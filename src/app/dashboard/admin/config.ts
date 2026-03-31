
import {
  Users,
  ShieldCheck,
  Building,
  Network,
  Store,
  MapPin,
  Briefcase,
  ShieldAlert,
} from 'lucide-react';
import React from 'react';

export type NavItemConfig = {
  value: string;
  label: string;
  permission: string;
  icon: React.ReactNode;
};

export const navItemsConfig: NavItemConfig[] = [
  // User & Access Management
  { value: '/dashboard/admin/users', label: 'Users', permission: 'manage_users', icon: React.createElement(Users) },
  { value: '/dashboard/admin/roles', label: 'Roles', permission: 'manage_roles', icon: React.createElement(ShieldCheck) },
  { value: '/dashboard/admin/security', label: 'Security Logs', permission: 'manage_security_logs', icon: React.createElement(ShieldAlert) },

  // Organizational Structure
  { value: '/dashboard/admin/offices', label: 'Offices', permission: 'manage_offices', icon: React.createElement(Briefcase) },
  { value: '/dashboard/admin/departments', label: 'Departments', permission: 'manage_departments', icon: React.createElement(Building) },
  { value: '/dashboard/admin/divisions', label: 'Divisions', permission: 'manage_divisions', icon: React.createElement(Network) },
  { value: '/dashboard/admin/districts', label: 'Districts', permission: 'manage_districts', icon: React.createElement(MapPin) },
  { value: '/dashboard/admin/branches', label: 'Branches', permission: 'manage_branches', icon: React.createElement(Store) },
];
