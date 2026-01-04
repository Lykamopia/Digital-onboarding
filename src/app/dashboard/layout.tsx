
"use client";

import React, { Suspense, useEffect, useState } from "react"
import type { Session } from "next-auth";
import { usePathname, useRouter } from "next/navigation";

import {
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useNotification } from "@/components/notification-provider"
import { getLoggedInUser } from "../actions/memo"
import type { Permission, User, MemoWithActivity } from "@/lib/types"
import { DashboardContentWrapper } from "./dashboard-content-wrapper"
import { HoneycombLoader } from "@/components/honeycomb-loader";
import { UserProfileLoader } from "@/components/user-profile-loader";
import { SettingsProvider } from "@/components/settings-provider";


function WebSocketHandler({ user }: { user: (User & { role: { permissions: Permission[] } }) | null }) {
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
                    if (!eventData.payload) return;

                    const memo: MemoWithActivity = eventData.payload;
                    const isRecipient = memo.to.some(u => u.id === user.id) || memo.cc.some(u => u.id === user.id) || memo.current_holderId === user.id;
                    
                    if (!isRecipient) return;

                    window.dispatchEvent(new CustomEvent('new-memo-received', { detail: { memo } }));
                    addNotification(memo);

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
  user: (User & { role: { permissions: Permission[] } }) | null;
  session: Session | null;
}

function DashboardLayoutClient({ children, user }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/dashboard/change-password') {
        router.replace('/dashboard/change-password');
    }
  }, [user, pathname, router]);

  if (user && user.mustChangePassword) {
    // If user must change password, only render the child page (change-password page)
    // inside a minimal layout, without the full dashboard shell.
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
        <WebSocketHandler user={user} />
        <DashboardContentWrapper user={user}>
            {children}
        </DashboardContentWrapper>
    </SidebarProvider>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = React.useState<(User & { role: { permissions: Permission[] } }) | null>(null);
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
