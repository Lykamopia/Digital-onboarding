
"use client";

import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/notification-provider';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Mail, BellOff } from 'lucide-react';
import { markAsRead as markMemoAsReadAction } from '@/app/actions/memo';
import { NotificationIllustration } from './notification-illustration';

export function NotificationList() {
    const { notifications, markAsRead, settings } = useNotification();
    const router = useRouter();

    const handleClick = (notification: typeof notifications[0]) => {
        markAsRead(notification.id);
        
        if (notification.memoId) {
            router.push(`/dashboard/inbox?id=${notification.memoId}`);
            // This persistently updates the memo's status on the backend
            markMemoAsReadAction(notification.memoId);
            // This dispatches a client-side event for optimistic UI updates in the memo list
            window.dispatchEvent(new CustomEvent('mark-memo-as-read', {
                detail: { memoId: notification.memoId }
            }));
        }
    }

    if (!settings.notificationsEnabled) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <BellOff className="h-10 w-10 mb-4" />
                <p className="font-semibold">Notifications are disabled.</p>
                <p>You can enable them in the settings.</p>
            </div>
        );
    }

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <NotificationIllustration />
                <p className="mt-4 font-semibold">All caught up!</p>
                <p>You have no new notifications.</p>
            </div>
        );
    }
    
    return (
        <div className="max-h-96 overflow-y-auto">
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={cn(
                        "flex items-start gap-3 p-3 border-b transition-colors cursor-pointer hover:bg-muted/50",
                        !notification.read && "bg-primary/5"
                    )}
                    onClick={() => handleClick(notification)}
                >
                    <div className="relative">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mail className="h-4 w-4 text-primary" />
                        </div>
                        {!notification.read && (
                            <span className="absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-background" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
