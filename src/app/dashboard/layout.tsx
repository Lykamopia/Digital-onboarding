
"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from 'next/navigation'
import { Archive, Inbox, Send, PanelLeft, FilePlus, Edit, Shield, User as UserIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  SidebarProvider,
  useSidebar,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { UserNav } from "@/components/user-nav"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationListener } from "@/components/notification-listener"
import { NotificationBell } from "@/components/notification-bell"
import { loggedInUser } from "@/lib/data"

const MobileSidebar = () => {
    const pathname = usePathname();
    const showAdminLink = loggedInUser.role.permissions.includes('view-admin');
    
    const navItems = [
        { href: "/dashboard?tab=inbox", icon: <Inbox />, label: "Inbox", visible: loggedInUser.role.permissions.includes('view-dashboard') },
        { href: "/dashboard?tab=drafts", icon: <Edit />, label: "Drafts", visible: loggedInUser.role.permissions.includes('manage-memos') },
        { href: "/dashboard?tab=sent", icon: <Send />, label: "Sent", visible: loggedInUser.role.permissions.includes('manage-memos') },
        { href: "/dashboard?tab=archive", icon: <Archive />, label: "Archive", visible: loggedInUser.role.permissions.includes('view-dashboard') },
        { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", visible: true },
    ];

    if (showAdminLink) {
        navItems.push({ href: "/dashboard/admin", icon: <Shield />, label: "Admin", visible: true });
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="sm:hidden">
                    <PanelLeft className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
                <nav className="grid gap-6 text-lg font-medium">
                     <Link
                        href="#"
                        className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
                    >
                       <Logo />
                       <span className="sr-only">Nib Memo</span>
                    </Link>
                    {navItems.filter(item => item.visible).map(item => (
                         <Link key={item.label} href={item.href} className={`flex items-center gap-4 px-2.5 ${pathname.startsWith(item.href.split('?')[0]) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {item.icon}
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    )
}

const DesktopSidebar = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const isInboxActive = pathname === '/dashboard' && (searchParams.get('tab') === 'inbox' || !searchParams.get('tab'));
    const isDraftsActive = searchParams.get('tab') === 'drafts';
    const isSentActive = searchParams.get('tab') === 'sent';
    const isArchiveActive = searchParams.get('tab') === 'archive';
    const showAdminLink = loggedInUser.role.permissions.includes('view-admin');


    const navItems = [
        { href: "/dashboard?tab=inbox", icon: <Inbox />, label: "Inbox", active: isInboxActive, visible: loggedInUser.role.permissions.includes('view-dashboard') },
        { href: "/dashboard?tab=drafts", icon: <Edit />, label: "Drafts", active: isDraftsActive, visible: loggedInUser.role.permissions.includes('manage-memos') },
        { href: "/dashboard?tab=sent", icon: <Send />, label: "Sent", active: isSentActive, visible: loggedInUser.role.permissions.includes('manage-memos') },
        { href: "/dashboard?tab=archive", icon: <Archive />, label: "Archive", active: isArchiveActive, visible: loggedInUser.role.permissions.includes('view-dashboard') },
        { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
    ];

    if (showAdminLink) {
        navItems.push({ href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: true });
    }

    return (
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
                                <SidebarMenuButton 
                                    tooltip={item.label}
                                    isActive={item.active}>
                                        {item.icon}
                                        <span>{item.label}</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    )
}

function DashboardLayoutContent({
    children,
  }: {
    children: React.ReactNode
  }) {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleNewMemoClick = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('memo-draft');
        }
    }

    if (!isClient) {
        return null; // or a loading skeleton
    }
    
    return (
        <div className={`grid min-h-screen w-full transition-[grid-template-columns] ease-in-out duration-300 md:grid-cols-[var(--sidebar-width)_1fr]`}>
            <DesktopSidebar />
            <div className="flex flex-col h-screen">
                <header className="flex h-14 items-center border-b bg-card no-print shrink-0 lg:h-[60px]">
                    <div className="flex items-center gap-4 w-full h-full px-4 lg:px-6">
                        <MobileSidebar />
                        <SidebarTrigger className="hidden md:flex" />
                        <div className="w-full flex-1">
                            {/* Optional: Add a search bar here */}
                        </div>
                        {loggedInUser.role.permissions.includes('manage-memos') && (
                            <Link href="/dashboard/new" onClick={handleNewMemoClick}>
                                <Button>
                                <FilePlus className="mr-2 h-4 w-4" />
                                New Memo
                                </Button>
                            </Link>
                        )}
                         <NotificationBell />
                        <UserNav />
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
    )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
        <NotificationListener />
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  )
}
