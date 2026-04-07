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
  const [isMounted, setIsMounted] = useState(false);

  const permissions = useMemo(() => user?.role?.permissions?.split(',') || [], [user?.role?.permissions]);

  const adminPermissions = useMemo(() => [
    'manage_users', 'manage_roles', 'manage_security_logs',
    'manage_offices', 'manage_departments', 'manage_divisions', 
    'manage_districts', 'manage_branches'
  ], []);

  const hasAdminAccess = useMemo(() => {
    if (!user) return false;
    return adminPermissions.some(p => permissions.includes(p as any));
  }, [user, permissions, adminPermissions]);

  const canSubmitOnboarding = useMemo(() => permissions.includes('verifier_customer_onboarding' as Permission), [permissions]);
  const canReviewOnboarding = useMemo(() => permissions.includes('approver_customer_onboarding' as Permission) || permissions.includes('verifier_customer_onboarding' as Permission), [permissions]);

  const navItems = useMemo(() => {
    if (!user) return [];
    
    return [
      { 
        href: "/dashboard/customer-onboarding", 
        icon: <Users2 className="h-4 w-4" />, 
        label: "Onboarding Status", 
        active: pathname === '/dashboard/customer-onboarding', 
        visible: (canSubmitOnboarding || canReviewOnboarding) 
      },
      { 
        href: "/dashboard/customer-onboarding/review", 
        icon: <ClipboardCheck className="h-4 w-4" />, 
        label: "Onboarding Pipeline", 
        active: pathname.startsWith('/dashboard/customer-onboarding/review'), 
        visible: canReviewOnboarding 
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
  }, [user, pathname, hasAdminAccess, canSubmitOnboarding, canReviewOnboarding]);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !user) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
  }

  const mustCompleteOnboarding = (user as any).onboardingCompleted === false;

  return (
    <>
    <SessionTimeoutManager disabled={mustCompleteOnboarding} />
    <div className="flex min-h-screen w-full transition-all duration-300 ease-in-out">
      <Sidebar collapsible="icon" className="hidden md:flex no-print">
        <SidebarContent title="Dashboard">
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
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="md:hidden">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs">
                <SheetHeader className="p-4">
                  <SheetTitle className="sr-only">Main Menu</SheetTitle>
                   <Link href="/dashboard/customer-onboarding" className="flex items-center gap-2">
                      <Logo />
                  </Link>
                </SheetHeader>
                <nav className="grid gap-4 p-4 text-lg font-medium">
                  {navItems.filter(item => item.visible && !item.className?.includes('hidden')).map(item => (
                    <Link key={item.label} href={item.href} className={`flex items-center gap-4 px-2.5 ${item.active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
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
