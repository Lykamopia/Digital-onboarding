
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, FilePlus, Inbox, PanelLeft, Send, Shield, User as UserIcon, Edit, Lock } from 'lucide-react';

import type { User, Permission, MemoWithActivity } from '@/lib/types';
import { useNotification } from '@/components/notification-provider';
import { getDashboardData } from '@/app/actions/memo';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { NotificationBell } from '@/components/notification-bell';
import { HoneycombLoader } from '@/components/honeycomb-loader';
import { SessionTimeoutManager } from '@/components/session-timeout-manager';

interface DashboardContentWrapperProps {
  user: (User & { role: { permissions: Permission[] } }) | null;
  children: React.ReactNode;
}

export function DashboardContentWrapper({ user, children }: DashboardContentWrapperProps) {
  const pathname = usePathname();
  const { showNotification } = useNotification();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user || user.mustChangePassword || !isMounted) return;

    const checkNewMemos = async () => {
      const inboxMemos: MemoWithActivity[] = await getDashboardData('inbox', '', '', {});

      let seenMemos: string[] = [];
      try {
        const stored = localStorage.getItem('seenMemos');
        seenMemos = stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.error("Could not parse seenMemos from localStorage", e);
      }

      const newMemos = inboxMemos.filter(memo => !seenMemos.includes(memo.id));

      if (newMemos.length > 0) {
        newMemos.forEach(memo => {
          const lastActivity = memo.activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          const isForward = lastActivity?.action === 'forwarded' && memo.current_holderId === user.id;

          if (isForward) {
            showNotification({
              title: 'Memo Delegated to You',
              description: `From: ${lastActivity.actor.name} - ${memo.subject}`,
              memoId: memo.id,
            });
          } else {
            showNotification({
              title: 'New Memo Received',
              description: `From: ${memo.from.name} - ${memo.subject}`,
              memoId: memo.id,
            });
          }

          // Dispatch custom event for real-time update
          window.dispatchEvent(new CustomEvent('new-memo-event', { detail: { memo } }));
        });

        const allSeenMemos = [...seenMemos, ...newMemos.map(m => m.id)];
        localStorage.setItem('seenMemos', JSON.stringify(allSeenMemos));
      }
    };

    // Initial check
    checkNewMemos();

    // Poll every 15 seconds
    const intervalId = setInterval(checkNewMemos, 15000);

    return () => clearInterval(intervalId);

  }, [user, showNotification, isMounted]);

  if (!isMounted || !user) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
  }

  const navItems = [
    ...(user.mustChangePassword
      ? [{ href: "/dashboard/change-password", icon: <Lock />, label: "Change Password", active: pathname === '/dashboard/change-password', visible: true }]
      : [
          { href: "/dashboard/inbox", icon: <Inbox />, label: "Inbox", active: pathname === '/dashboard/inbox', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/drafts", icon: <Edit />, label: "Drafts", active: pathname === '/dashboard/drafts', visible: user.role.permissions.includes('manage_memos' as Permission) },
          { href: "/dashboard/sent", icon: <Send />, label: "Sent", active: pathname === '/dashboard/sent', visible: user.role.permissions.includes('manage_memos' as Permission) },
          { href: "/dashboard/archive", icon: <Archive />, label: "Archive", active: pathname === '/dashboard/archive', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
          { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: user.role.permissions.includes('view_admin' as Permission) },
        ]),
  ];

  return (
    <>
    {!user.mustChangePassword && <SessionTimeoutManager />}
    <div className="grid min-h-screen w-full transition-[grid-template-columns] ease-in-out duration-300 md:grid-cols-[var(--sidebar-width)_1fr]">
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
              <SidebarMenuItem key={item.label}>
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
      <div className="flex flex-col h-screen">
        <header className="flex h-14 items-center border-b bg-card no-print shrink-0 lg:h-[60px]">
          <div className="flex items-center gap-4 w-full h-full px-4 lg:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="sm:hidden">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs">
                <nav className="grid gap-6 text-lg font-medium">
                  <Link href="#" className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base">
                    <Logo />
                    <span className="sr-only">Nib Memo</span>
                  </Link>
                  {navItems.filter(item => item.visible).map(item => (
                    <Link key={item.label} href={item.href} className={`flex items-center gap-4 px-2.5 ${item.active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <SidebarTrigger className="hidden md:flex" />
            <div className="w-full flex-1">
              {/* Optional: Add a search bar here */}
            </div>
            {user?.role.permissions.includes('manage_memos' as Permission) && !user.mustChangePassword && (
              <Link href="/dashboard/new">
                <Button>
                  <FilePlus className="mr-2 h-4 w-4" />
                  New Memo
                </Button>
              </Link>
            )}
            <NotificationBell />
            {user && <UserNav user={user} />}
          </div>
        </header>
        <main className="flex flex-1 flex-col bg-muted/40 overflow-auto no-print">
          <div className="flex-1 p-4">
            {children}
          </div>
        </main>
        <div className="hidden print:block">
          {children}
        </div>
      </div>
    </div>
    </>
  );
}
