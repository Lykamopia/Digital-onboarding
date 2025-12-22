
"use client";

import { Bell } from 'lucide-react';
import { useNotification } from '@/components/notification-provider';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const { notificationCount, resetNotificationCount } = useNotification();

  const handleClick = () => {
    // In a real app, this would open a notification drawer
    resetNotificationCount();
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={handleClick}
    >
      <Bell className="h-5 w-5" />
      {notificationCount > 0 && (
        <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {notificationCount}
        </span>
      )}
      <span className="sr-only">View notifications</span>
    </Button>
  );
}
