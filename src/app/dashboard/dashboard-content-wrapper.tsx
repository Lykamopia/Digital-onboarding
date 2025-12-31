
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Archive, FilePlus, Inbox, PanelLeft, Send, Shield, User as UserIcon, Edit, Lock, ShieldAlert } from 'lucide-react';

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
import { ThemeToggle } from '@/components/theme-toggle';

interface DashboardContentWrapperProps {
  user: (User & { role: { permissions: Permission[] } }) | null;
  children: React.ReactNode;
}

export function DashboardContentWrapper({ user, children }: DashboardContentWrapperProps) {
  const pathname = usePathname();
  const { addNotificationToList, showNotification } = useNotification();
  const [isMounted, setIsMounted] = useState(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user || user.mustChangePassword || !isMounted) return;

    // This function runs only once on initial load to populate the notification list
    // Only fetch if we're not already on the inbox page (to avoid duplicate requests)
    const checkInitialMemos = async () => {
      if (!isInitialLoad.current) return;
      isInitialLoad.current = false;

      // Skip if we're on the inbox page - the page component already loaded the data
      // This prevents duplicate requests on initial load
      if (pathname === '/dashboard/inbox') {
        return;
      }

      const inboxMemos: MemoWithActivity[] = await getDashboardData('inbox', '', '', { from: undefined, to: undefined }, [], '');
      
      const unreadMemos = inboxMemos.filter(memo => 
          !memo.activity.some(act => act.action === 'viewed' && act.actorId === user.id) &&
          !memo.acknowledgedBy?.some(ackUser => ackUser.id === user.id)
      );

      if (unreadMemos.length > 0) {
        unreadMemos.forEach(memo => {
          const lastActivity = memo.activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          const isForward = lastActivity?.action === 'forwarded' && memo.current_holderId === user.id;
          
          const notificationPayload = {
            title: isForward ? 'Memo Delegated to You' : 'New Memo Received',
            description: `From: ${isForward && lastActivity.actor ? lastActivity.actor.name : memo.from.name} - ${memo.subject}`,
            memoId: memo.id,
          };
          
          // On initial load, just add to the list without a toast.
          addNotificationToList(notificationPayload);
        });
      }
      
    };

    // Initial check
    checkInitialMemos();

  }, [user, addNotificationToList, isMounted, pathname]);

  if (!isMounted || !user) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
  }

  const navItems = [
    ...(user.mustChangePassword
      ? [
          { href: "/dashboard/change-password", icon: <Lock />, label: "Change Password", active: pathname === '/dashboard/change-password', visible: true },
          { href: "/dashboard/access-denied", icon: <ShieldAlert />, label: "Access Denied", active: pathname === '/dashboard/access-denied', visible: true, className: "hidden" },
        ]
      : [
          { href: "/dashboard/inbox", icon: <Inbox />, label: "Inbox", active: pathname === '/dashboard/inbox', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/drafts", icon: <Edit />, label: "Drafts", active: pathname === '/dashboard/drafts', visible: user.role.permissions.includes('manage_memos' as Permission) },
          { href: "/dashboard/sent", icon: <Send />, label: "Sent", active: pathname === '/dashboard/sent', visible: user.role.permissions.includes('manage_memos' as Permission) },
          { href: "/dashboard/archive", icon: <Archive />, label: "Archive", active: pathname === '/dashboard/archive', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
          { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: user.role.permissions.includes('view_admin' as Permission) },
          { href: "/dashboard/access-denied", icon: <ShieldAlert />, label: "Access Denied", active: pathname === '/dashboard/access-denied', visible: true, className: "hidden" },
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
      <div className="flex flex-col h-screen">
        <header className="flex h-14 items-center border-b bg-card no-print shrink-0 lg:h-[60px]">
          <div className="flex items-center gap-4 w-full h-full px-4 lg:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="md:hidden">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs">
                <nav className="grid gap-6 text-lg font-medium">
                  <Link href="#" className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base">
                    <Logo hideText />
                    <span className="sr-only">Nib Memo</span>
                  </Link>
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
      </div>
    </div>
    </>
  );
}
