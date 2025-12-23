
"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from 'next/navigation'
import { Archive, Inbox, Send, PanelLeft, FilePlus, Edit, Shield, User as UserIcon } from "lucide-react"
import { Suspense, use, useEffect, useMemo, useState } from "react"

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
import { HoneycombLoader } from "@/components/honeycomb-loader"
import { getLoggedInUser } from "../actions/memo"
import type { Permission } from "@/lib/types"

function NavItems({ isMobile = false }: { isMobile?: boolean }) {
    const user = use(getLoggedInUser());
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    const isInboxActive = pathname === '/dashboard' && (searchParams.get('tab') === 'inbox' || !searchParams.get('tab'));
    const isDraftsActive = searchParams.get('tab') === 'drafts';
    const isSentActive = searchParams.get('tab') === 'sent';
    const isArchiveActive = searchParams.get('tab') === 'archive';
    
    const navItems = useMemo(() => [
        { href: "/dashboard?tab=inbox", icon: <Inbox />, label: "Inbox", active: isInboxActive, visible: user.role.permissions.includes('view_dashboard' as Permission) },
        { href: "/dashboard?tab=drafts", icon: <Edit />, label: "Drafts", active: isDraftsActive, visible: user.role.permissions.includes('manage_memos' as Permission) },
        { href: "/dashboard?tab=sent", icon: <Send />, label: "Sent", active: isSentActive, visible: user.role.permissions.includes('manage_memos' as Permission) },
        { href: "/dashboard?tab=archive", icon: <Archive />, label: "Archive", active: isArchiveActive, visible: user.role.permissions.includes('view_dashboard' as Permission) },
        { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
        { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: user.role.permissions.includes('view_admin' as Permission) },
    ], [pathname, searchParams, user]);

    if (isMobile) {
         return (
            <nav className="grid gap-6 text-lg font-medium">
                 <Link
                    href="#"
                    className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
                >
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
        );
    }

    return (
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
    );
}


const MobileSidebar = () => (
    <Sheet>
        <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
            <Suspense fallback={<div className="text-lg font-medium">Loading...</div>}>
                 <NavItems isMobile={true} />
            </Suspense>
        </SheetContent>
    </Sheet>
)

const DesktopSidebar = () => (
    <Sidebar collapsible="icon" className="hidden md:flex no-print">
        <SidebarContent>
            <SidebarHeader className="h-14 lg:h-[60px] border-b justify-center">
                <div className="flex items-center group-data-[collapsible=icon]:justify-center">
                    <Logo className="group-data-[collapsible=icon]:hidden" />
                    <Logo className="hidden group-data-[collapsible=icon]:flex" hideText />
                </div>
            </SidebarHeader>
            <Suspense fallback={
                <div className="flex-1 px-3 space-y-2">
                    <div className="h-10" />
                    <div className="h-10" />
                    <div className="h-10" />
                </div>
            }>
                <NavItems />
            </Suspense>
        </SidebarContent>
    </Sidebar>
)

function DashboardLayoutContent({
    children,
  }: {
    children: React.ReactNode
  }) {
    const [isClient, setIsClient] = useState(false);
    const user = use(getLoggedInUser());
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleNewMemoClick = () => {
        // This functionality will be handled on the new memo page now
    }

    if (!isClient || !user) {
        return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
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
                        {user.role.permissions.includes('manage_memos' as Permission) && (
                            <Link href="/dashboard/new" onClick={handleNewMemoClick}>
                                <Button>
                                <FilePlus className="mr-2 h-4 w-4" />
                                New Memo
                                </Button>
                            </Link>
                        )}
                         <NotificationBell />
                        <UserNav user={user} />
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
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>}>
            <NotificationListener />
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </Suspense>
    </SidebarProvider>
  )
}
