"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Archive, Inbox, Send, PanelLeft } from "lucide-react"

import {
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { UserNav } from "@/components/user-nav"
import { NewMemoDialog } from "@/components/new-memo-dialog"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const MobileSidebar = () => {
    const pathname = usePathname();
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
                    <Link href="/dashboard?tab=inbox" className={`flex items-center gap-4 px-2.5 ${pathname === '/dashboard' || pathname.includes('inbox') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        <Inbox className="h-5 w-5" />
                        Inbox
                    </Link>
                    <Link href="/dashboard?tab=sent" className={`flex items-center gap-4 px-2.5 ${pathname.includes('sent') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        <Send className="h-5 w-5" />
                        Sent
                    </Link>
                    <Link href="/dashboard?tab=archive" className={`flex items-center gap-4 px-2.5 ${pathname.includes('archive') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        <Archive className="h-5 w-5" />
                        Archive
                    </Link>
                </nav>
            </SheetContent>
        </Sheet>
    )
}

const DesktopSidebar = () => {
    const { state } = useSidebar();
    const pathname = usePathname();

    return (
        <aside className="hidden border-r bg-card md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <Logo />
                    </Link>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                         <Link href="/dashboard?tab=inbox" className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname === '/dashboard' || pathname.includes('inbox') ? 'text-primary bg-muted' : 'text-muted-foreground hover:text-primary'}`}>
                            <Inbox className="h-4 w-4" />
                            Inbox
                        </Link>
                        <Link href="/dashboard?tab=sent" className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname.includes('sent') ? 'text-primary bg-muted' : 'text-muted-foreground hover:text-primary'}`}>
                            <Send className="h-4 w-4" />
                            Sent
                        </Link>
                         <Link href="/dashboard?tab=archive" className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname.includes('archive') ? 'text-primary bg-muted' : 'text-muted-foreground hover:text-primary'}`}>
                            <Archive className="h-4 w-4" />
                            Archive
                        </Link>
                    </nav>
                </div>
            </div>
        </aside>
    )
}

function DashboardLayoutContent({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            <DesktopSidebar />
            <div className="flex flex-col">
                <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
                    <MobileSidebar />
                    <div className="w-full flex-1">
                        {/* Optional: Add a search bar here */}
                    </div>
                    <NewMemoDialog />
                    <UserNav />
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
                    {children}
                </main>
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
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  )
}
