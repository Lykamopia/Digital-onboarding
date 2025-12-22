
"use client";

import { Bell } from 'lucide-react';
import { useNotification } from '@/components/notification-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { NotificationList } from './notification-list';

export function NotificationBell() {
  const { unreadCount, markAllAsRead } = useNotification();

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className="relative"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadCount}
                    </span>
                )}
                <span className="sr-only">View notifications</span>
            </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex justify-between items-center p-2">
            <DropdownMenuLabel className="font-semibold p-0">Notifications</DropdownMenuLabel>
            {unreadCount > 0 && (
                 <Button variant="link" size="sm" className="h-auto p-0" onClick={markAllAsRead}>Mark all as read</Button>
            )}
        </div>
        <DropdownMenuSeparator />
        <NotificationList />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
