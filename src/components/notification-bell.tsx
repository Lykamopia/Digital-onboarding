
"use client";

import { useState } from 'react';
import { Bell, Settings } from 'lucide-react';
import { useNotification } from '@/components/notification-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotificationList } from './notification-list';
import { NotificationSettings } from './notification-settings';

export function NotificationBell() {
  const { unreadCount, markAllAsRead } = useNotification();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    window.dispatchEvent(new CustomEvent('mark-all-memos-as-read'));
  }

  const handleSettingsDialogClose = (open: boolean) => {
    setIsSettingsDialogOpen(open);
    if (!open) {
      // Force cleanup of any remaining overlay elements
      setTimeout(() => {
        // Clean up all possible overlay elements using Radix UI data attributes
        const allOverlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
        allOverlays.forEach(overlay => {
          const state = overlay.getAttribute('data-state');
          if (!state || state === 'closed') {
            (overlay as HTMLElement).style.display = 'none';
            overlay.remove();
          }
        });
        // Ensure body styles are reset
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }, 200);
    }
  };

  return (
    <Dialog open={isSettingsDialogOpen} onOpenChange={handleSettingsDialogClose}>
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
              <div className='flex items-center gap-2'>
                {unreadCount > 0 && (
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={handleMarkAllAsRead}>Mark all as read</Button>
                )}
                <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => setIsSettingsDialogOpen(true)}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
              </div>
          </div>
          <DropdownMenuSeparator />
          <NotificationList />
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
        </DialogHeader>
        <div className="py-4">
            <NotificationSettings />
        </div>
      </DialogContent>
    </Dialog>
  );
}
