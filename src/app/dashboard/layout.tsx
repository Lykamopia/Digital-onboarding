
"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Archive, Inbox, Send, PanelLeft, FilePlus, Edit, Shield, User as UserIcon } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"

import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { UserNav } from "@/components/user-nav"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationListener } from "@/components/notification-listener"
import { NotificationBell } from "@/components/notification-bell"
import { HoneycombLoader } from "@/components/honeycomb-loader"
import { getLoggedInUser } from "../actions/memo"
import type { Permission, User } from "@/lib/types"

function NavItems({ isMobile = false, user }: { isMobile?: boolean, user: User & { role: { permissions: Permission[] } } | null }) {
    const pathname = usePathname();
    
    const navItems = useMemo(() => {
        if (!user) return [];
        return [
            { href: "/dashboard/inbox", icon: <Inbox />, label: "Inbox", active: pathname === '/dashboard/inbox', visible: user.role.permissions.includes('view_dashboard' as Permission) },
            { href: "/dashboard/drafts", icon: <Edit />, label: "Drafts", active: pathname === '/dashboard/drafts', visible: user.role.permissions.includes('manage_memos' as Permission) },
            { href: "/dashboard/sent", icon: <Send />, label: "Sent", active: pathname === '/dashboard/sent', visible: user.role.permissions.includes('manage_memos' as Permission) },
            { href: "/dashboard/archive", icon: <Archive />, label: "Archive", active: pathname === '/dashboard/archive', visible: user.role.permissions.includes('view_dashboard' as Permission) },
            { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
            { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: user.role.permissions.includes('view_admin' as Permission) },
        ]
    }, [pathname, user]);

    if (!user) {
        return (
             <div className="flex-1 px-3 space-y-2">
                <div className="h-10" />
                <div className="h-10" />
                <div className="h-10" />
            </div>
        )
    }

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


const MobileSidebar = ({ user }: { user: User & { role: { permissions: Permission[] } } | null }) => (
    <Sheet>
        <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
             <NavItems isMobile={true} user={user} />
        </SheetContent>
    </Sheet>
)

const DesktopSidebar = ({ user }: { user: User & { role: { permissions: Permission[] } } | null }) => (
    <Sidebar collapsible="icon" className="hidden md:flex no-print">
        <SidebarContent>
            <SidebarHeader className="h-14 lg:h-[60px] border-b justify-center">
                <div className="flex items-center group-data-[collapsible=icon]:justify-center">
                    <Logo className="group-data-[collapsible=icon]:hidden" />
                    <Logo className="hidden group-data-[collapsible=icon]:flex" hideText />
                </div>
            </SidebarHeader>
            <NavItems user={user} />
        </SidebarContent>
    </Sidebar>
)

function DashboardLayoutContent({
    children,
  }: {
    children: React.ReactNode
  }) {
    const [user, setUser] = useState<User & { role: { permissions: Permission[] } } | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        getLoggedInUser().then(userData => {
            setUser(userData);
            setLoading(false);
        });
    }, []);

    const handleNewMemoClick = () => {
        // This functionality will be handled on the new memo page now
    }

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
    }
    
    return (
        <div className={`grid min-h-screen w-full transition-[grid-template-columns] ease-in-out duration-300 md:grid-cols-[var(--sidebar-width)_1fr]`}>
            <DesktopSidebar user={user} />
            <div className="flex flex-col h-screen">
                <header className="flex h-14 items-center border-b bg-card no-print shrink-0 lg:h-[60px]">
                    <div className="flex items-center gap-4 w-full h-full px-4 lg:px-6">
                        <MobileSidebar user={user} />
                        <SidebarTrigger className="hidden md:flex" />
                        <div className="w-full flex-1">
                            {/* Optional: Add a search bar here */}
                        </div>
                        {user?.role.permissions.includes('manage_memos' as Permission) && (
                            <Link href="/dashboard/new" onClick={handleNewMemoClick}>
                                <Button>
                                <FilePlus className="mr-2 h-4 w-4" />
                                New Memo
                                </Button>
                            </Link>
                        )}
                         <NotificationBell />
                         { user && <UserNav user={user} /> }
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
