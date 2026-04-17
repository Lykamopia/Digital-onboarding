'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  PanelLeft, Shield, User as UserIcon, 
  ShieldAlert, Users2, ClipboardCheck 
} from 'lucide-react';

import type { Permission, LoggedInUser } from '@/lib/types';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { NotificationBell } from '@/components/notification-bell';
import { HoneycombLoader } from '@/components/honeycomb-loader';
import { SessionTimeoutManager } from '@/components/session-timeout-manager';
import { ThemeToggle } from '@/components/theme-toggle';
import { Breadcrumb } from '@/components/breadcrumb';

interface DashboardContentWrapperProps {
  user: LoggedInUser | null;
  children: React.ReactNode;
}

export function DashboardContentWrapper({ user, children }: DashboardContentWrapperProps) {
  const pathname = usePathname();

  const permissions = useMemo(() => user?.role?.permissions?.split(',').map(p => p.trim()) || [], [user?.role?.permissions]);

  const adminPermissions = useMemo(() => [
    'manage_users', 'manage_roles', 'manage_security_logs',
    'manage_offices', 'manage_departments', 'manage_divisions', 
    'manage_districts', 'manage_branches'
  ], []);

  const hasAdminAccess = useMemo(() => {
    if (!user) return false;
    return adminPermissions.some(p => permissions.includes(p as any));
  }, [user, permissions, adminPermissions]);

  const isAdmin = useMemo(() => permissions.includes('admin' as Permission), [permissions]);
  const canSubmitOnboarding = useMemo(() => permissions.includes('verifier_customer_onboarding' as Permission) || isAdmin, [permissions, isAdmin]);
  const canReviewOnboarding = useMemo(() => permissions.includes('approver_customer_onboarding' as Permission) || permissions.includes('verifier_customer_onboarding' as Permission) || isAdmin, [permissions, isAdmin]);
  const canViewOnboarding = useMemo(() => permissions.includes('viewer_customer_onboarding' as Permission), [permissions]);

  const navItems = useMemo(() => {
    if (!user) return [];
    
    return [
      { 
        href: "/dashboard/customer-onboarding", 
        icon: <Users2 className="h-4 w-4" />, 
        label: "Onboarding Status", 
        active: pathname === '/dashboard/customer-onboarding', 
        visible: (canSubmitOnboarding || canReviewOnboarding || canViewOnboarding) 
      },
      { 
        href: "/dashboard/customer-onboarding/review", 
        icon: <ClipboardCheck className="h-4 w-4" />, 
        label: "Onboarding Pipeline", 
        active: pathname.startsWith('/dashboard/customer-onboarding/review'), 
        visible: (canReviewOnboarding || canViewOnboarding) 
      },
      { 
        href: "/dashboard/profile", 
        icon: <UserIcon className="h-4 w-4" />, 
        label: "Profile Settings", 
        active: pathname === '/dashboard/profile', 
        visible: true 
      },
      { 
        href: "/dashboard/admin", 
        icon: <Shield className="h-4 w-4" />, 
        label: "Admin Management", 
        active: pathname.startsWith('/dashboard/admin'), 
        visible: hasAdminAccess 
      },
      { href: "/dashboard/access-denied", icon: <ShieldAlert />, label: "Access Denied", active: pathname === '/dashboard/access-denied', visible: true, className: "hidden" },
    ];
  }, [user, pathname, hasAdminAccess, canSubmitOnboarding, canReviewOnboarding, canViewOnboarding]);
  
  if (!user) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
  }

  const mustCompleteOnboarding = (user as any).onboardingCompleted === false;

  return (
    <>
    <SessionTimeoutManager disabled={mustCompleteOnboarding} />
    <div className="flex min-h-screen w-full transition-all duration-300 ease-in-out">
      <Sidebar collapsible="icon" className="hidden md:flex no-print">
        <SidebarContent>
          <SidebarHeader className="h-14 lg:h-[60px] border-b justify-center">
            <div className="flex items-center group-data-[collapsible=icon]:justify-center">
              <Logo className="group-data-[collapsible=icon]:hidden" />
              <Logo className="hidden group-data-[collapsible=icon]:flex" hideText />
            </div>
          </SidebarHeader>
          <SidebarMenu className="flex-1 px-3">
            {navItems.filter(item => item.visible).map(item => (
              <SidebarMenuItem key={item.label} className={item.className}>
                <Link href={item.href}>
                  <SidebarMenuButton tooltip={item.label} isActive={item.active}>
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      
      <SidebarInset className="flex flex-col h-screen min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-card/60 backdrop-blur-md no-print shrink-0 lg:h-[60px]">
          <div className="flex items-center gap-4 w-full h-full px-4 lg:px-6">
            <SidebarTrigger className="hidden md:flex" />
            <div className="md:flex items-center">
              <Breadcrumb />
            </div>
            <div className="w-full flex-1">
            </div>
            <ThemeToggle />
            <NotificationBell />
            {user && <UserNav user={user} />}
          </div>
        </header>
        <main className="flex flex-1 flex-col bg-muted/40 overflow-auto no-print">
          <div className="flex-1 p-4 min-h-0">
            {children}
          </div>
        </main>
        <div className="hidden print:block">
          {children}
        </div>
      </SidebarInset>
    </div>
    </>
  );
}
