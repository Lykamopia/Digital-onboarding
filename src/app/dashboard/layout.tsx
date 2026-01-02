
'use client';

import { Suspense, useEffect } from "react"
import type { Session } from "next-auth";

import {
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useNotification } from "@/components/notification-provider"
import { getLoggedInUser } from "../actions/memo"
import type { Permission, User, MemoWithActivity } from "@/lib/types"
import { DashboardContentWrapper } from "./dashboard-content-wrapper"
import { HoneycombLoader } from "@/components/honeycomb-loader";
import { usePathname } from "next/navigation";


function WebSocketHandler({ user }: { user: (User & { role: { permissions: Permission[] } }) | null }) {
    const { showNotification } = useNotification();
    const pathname = usePathname();

    useEffect(() => {
        if (!user) return;

        const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
        let socket: WebSocket;
        let reconnectTimeout: NodeJS.Timeout;

        function connect() {
            socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                console.log('WebSocket connection established');
                // Reset reconnect timer on successful connection
                if (reconnectTimeout) clearTimeout(reconnectTimeout);
            };

            socket.onclose = () => {
                console.log('WebSocket connection closed. Reconnecting in 3s...');
                // Schedule a reconnect
                reconnectTimeout = setTimeout(connect, 3000);
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                // The onclose event will fire next, which will handle the reconnect.
            };

            socket.onmessage = (event) => {
                try {
                    const eventData = JSON.parse(event.data);
                    if (!eventData.payload) return;

                    const memo: MemoWithActivity = eventData.payload;
                    const isRecipient = memo.to.some(u => u.id === user.id) || memo.cc.some(u => u.id === user.id) || memo.current_holderId === user.id;
                    
                    if (!isRecipient) return;

                    // Trigger client-side event for UI updates (e.g., memo list)
                    window.dispatchEvent(new CustomEvent('new-memo-received', { detail: { memo } }));

                    let title = '';
                    let description = '';

                    switch (eventData.type) {
                        case 'new-memo':
                            title = 'New Memo Received';
                            description = `From: ${memo.from.name} - ${memo.subject}`;
                            break;
                        case 'reply-memo':
                             title = 'New Reply Received';
                             description = `From: ${memo.from.name} - ${memo.subject}`;
                             break;
                        case 'forwarded-memo':
                            const lastActivity = memo.activity.find(a => a.action === 'forwarded');
                            const forwarderName = lastActivity?.actor?.name || 'Someone';
                            title = 'Memo Delegated to You';
                            description = `From: ${forwarderName} - ${memo.subject}`;
                            break;
                    }
                    
                    if (title) {
                        showNotification({ title, description, memoId: memo.id });
                    }

                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
        }

        connect();

        return () => {
            // Cleanup on component unmount
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (socket) {
                // Remove the onclose handler before closing to prevent reconnect attempts
                socket.onclose = null;
                socket.close();
            }
        };

    }, [user, showNotification, pathname]);

    return null;
}


interface DashboardLayoutProps {
  children: React.ReactNode;
  user: (User & { role: { permissions: Permission[] } }) | null;
  session: Session | null;
}

function DashboardLayoutClient({ children, user }: DashboardLayoutProps) {
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

  React.useEffect(() => {
    getLoggedInUser().then(userData => {
      setUser(userData as any);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>;
  }

  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>}>
        <DashboardLayoutClient user={user}>
            {children}
        </DashboardLayoutClient>
    </Suspense>
  )
}
