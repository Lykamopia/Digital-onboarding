

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Archive, Inbox, Send, PanelLeft, FilePlus, Edit, Shield, User as UserIcon, Lock } from "lucide-react"
import { Suspense, useMemo } from "react"

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
import { getLoggedInUser } from "../actions/memo"
import type { Permission, User } from "@/lib/types"
import { DashboardContentWrapper } from "./dashboard-content-wrapper"

function NavItems({ isMobile = false, user, pathname }: { isMobile?: boolean, user: User & { role: { permissions: Permission[] } } | null, pathname: string }) {
    
    const navItems = useMemo(() => {
        if (!user) return [];

        if (user.mustChangePassword) {
            return [
                 { href: "/dashboard/change-password", icon: <Lock />, label: "Change Password", active: pathname === '/dashboard/change-password', visible: true },
            ]
        }

        return [
            { href: "/dashboard/inbox", icon: <Inbox />, label: "Inbox", active: pathname === '/dashboard/inbox', visible: user.role.permissions.includes('view_dashboard' as Permission) },
            { href: "/dashboard/drafts", icon: <Edit />, label: "Drafts", active: pathname === '/dashboard/drafts', visible: user.role.permissions.includes('manage_memos' as Permission) },
            { href: "/dashboard/sent", icon: <Send />, label: "Sent", active: pathname === '/dashboard/sent', visible: user.role.permissions.includes('manage_memos' as Permission) },
            { href: "/dashboard/archive", icon: <Archive />, label: "Archive", active: pathname === '/dashboard/archive', visible: user.role.permissions.includes('view_dashboard' as Permission) },
            { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
            { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: user.role.permissions.includes('view_admin' as Permission) },
        ]
    }, [pathname, user]);

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

const MobileSidebar = ({ user, pathname }: { user: User & { role: { permissions: Permission[] } } | null, pathname: string }) => (
    <Sheet>
        <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
             <NavItems isMobile={true} user={user} pathname={pathname} />
        </SheetContent>
    </Sheet>
)

const DesktopSidebar = ({ user, pathname }: { user: User & { role: { permissions: Permission[] } } | null, pathname: string }) => (
    <Sidebar collapsible="icon" className="hidden md:flex no-print">
        <SidebarContent>
            <SidebarHeader className="h-14 lg:h-[60px] border-b justify-center">
                <div className="flex items-center group-data-[collapsible=icon]:justify-center">
                    <Logo className="group-data-[collapsible=icon]:hidden" />
                    <Logo className="hidden group-data-[collapsible=icon]:flex" hideText />
                </div>
            </SidebarHeader>
            <NavItems user={user} pathname={pathname} />
        </SidebarContent>
    </Sidebar>
)


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getLoggedInUser();

  return (
    <SidebarProvider>
        <Suspense fallback={<div>Loading...</div>}>
            <NotificationListener />
            <DashboardContentWrapper user={user as (User & { role: { permissions: Permission[]; }; }) | null}>
                {children}
            </DashboardContentWrapper>
        </Suspense>
    </SidebarProvider>
  )
}
