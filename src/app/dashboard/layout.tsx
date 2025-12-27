

import Link from "next/link"
import { Archive, Inbox, Send, PanelLeft, FilePlus, Edit, Shield, User as UserIcon, Lock, ShieldAlert } from "lucide-react"
import { Suspense } from "react"
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  SidebarProvider,
} from "@/components/ui/sidebar"
import { NotificationListener } from "@/components/notification-listener"
import { getLoggedInUser } from "../actions/memo"
import type { Permission, User } from "@/lib/types"
import { DashboardContentWrapper } from "./dashboard-content-wrapper"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions);
  // We fetch the full user object to get role permissions, which are not on the default session
  const user = session?.user?.email ? await getLoggedInUser() : null;

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
