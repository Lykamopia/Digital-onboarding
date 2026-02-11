
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
import { OnboardingTour } from "@/components/onboarding-tour";


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

  // WebSocket connection logic is now here to prevent conditional hook rendering
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

                // This component's `user` state is always available here
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
            socket.onclose = null; // Prevent reconnecting on component unmount
            socket.close();
        }
    };
  }, [user, addNotification]);

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
        {user && !user.onboardingCompleted && (
          <OnboardingTour />
        )}
    </SidebarProvider>
  );
}
