
"use client";

import React, { Suspense, useEffect, useState } from "react"
import type { Session } from "next-auth";
import { usePathname, useRouter } from "next/navigation";

import {
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useNotification } from "@/components/notification-provider"
import type { LoggedInUser } from "@/lib/types"
import { DashboardContentWrapper } from "./dashboard-content-wrapper"
import { UserProfileLoader } from "@/components/user-profile-loader";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/components/settings-provider";


interface DashboardLayoutClientProps {
  children: React.ReactNode;
  user: LoggedInUser | null;
}

export function DashboardLayoutClient({ children, user: initialUser }: DashboardLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [user, setUser] = useState(initialUser);
  const { initializeNotifications, addNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();



  useEffect(() => {
    if(initialUser) {
        setUser(initialUser);
        initializeNotifications(initialUser);
    }
    setLoading(false);
  }, [initialUser, initializeNotifications]);

  React.useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      setUser(prev => prev ? ({ ...prev, ...detail }) : detail);
    };
    window.addEventListener('profile-updated', handler as EventListener);
    return () => window.removeEventListener('profile-updated', handler as EventListener);
  }, []);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><UserProfileLoader /></div>;
  }

  return (
    <SidebarProvider>
        <DashboardContentWrapper user={user}>
            {children}
        </DashboardContentWrapper>
        {isMobile && user && <BottomNavigation user={user} />}
    </SidebarProvider>
  );
}
