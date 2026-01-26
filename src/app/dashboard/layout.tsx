
"use client";

import React, { Suspense, useEffect, useState } from "react"
import type { Session } from "next-auth";
import { usePathname, useRouter } from "next/navigation";

import {
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useNotification } from "@/components/notification-provider"
import { getLoggedInUser } from "../actions/memo"
import type { Permission, User, MemoWithActivity, LoggedInUser } from "@/lib/types"
import { DashboardContentWrapper } from "./dashboard-content-wrapper"
import { HoneycombLoader } from "@/components/honeycomb-loader";
import { UserProfileLoader } from "@/components/user-profile-loader";
import { SettingsProvider } from "@/components/settings-provider";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { OnboardingTour } from "@/components/onboarding-tour";


function WebSocketHandler({ user }: { user: LoggedInUser | null }) {
    const { addNotification } = useNotification();

    useEffect(() => {
        if (!user) return;

        const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3011';
        let socket: WebSocket;
        let reconnectTimeout: NodeJS.Timeout;

        function connect() {
            socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                console.log('WebSocket connection established');
                if (reconnectTimeout) clearTimeout(reconnectTimeout);
            };

            socket.onclose = () => {
                console.log('WebSocket connection closed. Reconnecting in 3s...');
                reconnectTimeout = setTimeout(connect, 3000);
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            socket.onmessage = (event) => {
                try {
                    const eventData = JSON.parse(event.data);
                    const { type, payload, recipientIds } = eventData;
                    if (!payload || !recipientIds) return;
                    
                    const isRecipient = recipientIds.includes(user.id);
                    if (!isRecipient) return;

                    window.dispatchEvent(new CustomEvent('new-memo-received', { detail: { memo: payload } }));
                    addNotification(payload, type);

                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
        }

        connect();

        return () => {
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (socket) {
                socket.onclose = null;
                socket.close();
            }
        };

    }, [user, addNotification]);

    return null;
}


interface DashboardLayoutProps {
  children: React.ReactNode;
  user: LoggedInUser | null;
}

function DashboardLayoutClient({ children, user }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/dashboard/change-password') {
        router.replace('/dashboard/change-password');
    }
  }, [user, pathname, router]);

  if (user && user.mustChangePassword) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full" />
        <svg
            viewBox="0 0 1024 1024"
            className="absolute left-1/3 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
            aria-hidden="true"
        >
            <circle cx={512} cy={512} r={512} fill="url(#9a759170-4320-4e94-a7de-180a42ebb9e1)" fillOpacity="0.7" />
            <defs>
            <radialGradient id="9a759170-4320-4e94-a7de-180a42ebb9e1">
                <stop stopColor="hsl(var(--primary))" />
                <stop offset={1} stopColor="hsl(var(--accent))" />
            </radialGradient>
            </defs>
        </svg>
        <div className="z-10">
          {children}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
        <WebSocketHandler user={user} />
        <DashboardContentWrapper user={user}>
            {children}
        </DashboardContentWrapper>
        {isMobile && user && <BottomNavigation user={user} />}
        {user && !user.mustChangePassword && !user.onboardingCompleted && (
          <OnboardingTour />
        )}
    </SidebarProvider>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = React.useState<LoggedInUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { initializeNotifications } = useNotification();

  useEffect(() => {
    getLoggedInUser().then(async (userData) => {
      if (userData) {
        setUser(userData as any);
        if (!userData.mustChangePassword) {
            await initializeNotifications(userData);
        }
      }
      setLoading(false);
    });
  }, [initializeNotifications]);

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
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>}>
        <SettingsProvider>
            <DashboardLayoutClient user={user}>
                {children}
            </DashboardLayoutClient>
        </SettingsProvider>
    </Suspense>
  )
}

    