
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { getDashboardData } from '@/app/actions/memo';
import type { MemoWithActivity, User } from '@/lib/types';

type Notification = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  createdAt: Date;
  read: boolean; // This will now represent if it's in the dropdown, not DB status
  memoId?: string;
};

type ShowNotificationProps = {
    title: string;
    description: string;
} & { memoId?: string };

type NotificationContextType = {
  settings: NotificationSettings;
  setSettings: (settings: Partial<NotificationSettings>) => void;
  showNotification: (props: ShowNotificationProps) => void;
  addNotification: (memo: MemoWithActivity, type?: string) => void;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  initializeNotifications: (user: User) => Promise<void>;
};

type NotificationSettings = {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [settings, setSettingsState] = useState<NotificationSettings>(() => {
    if (typeof window === 'undefined') {
      return { notificationsEnabled: true, soundEnabled: true };
    }
    try {
      const item = window.localStorage.getItem('notification-settings');
      return item ? JSON.parse(item) : { notificationsEnabled: true, soundEnabled: true };
    } catch (error) {
      console.error(error);
      return { notificationsEnabled: true, soundEnabled: true };
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const audioInstance = new Audio('/ring.mp3');
        audioInstance.load();
        setAudio(audioInstance);
    }
  }, []);

  const setSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettingsState(prev => {
      const updatedSettings = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('notification-settings', JSON.stringify(updatedSettings));
      }

      // Play test sound if sound is being enabled
      if (newSettings.soundEnabled && !prev.soundEnabled && audio) {
        audio.play().catch(error => console.error("Test sound playback failed:", error));
      }

      return updatedSettings;
    });
  };
  
  const initializeNotifications = useCallback(async (user: User) => {
    const inboxMemos: MemoWithActivity[] = await getDashboardData('inbox', '', 'all', {}, [], '', 'all');
    const unreadMemos = inboxMemos.filter(memo => 
        !memo.activity.some(act => act.action === 'viewed' && act.actorId === user.id) &&
        !memo.acknowledgedBy?.some(ackUser => ackUser.id === user.id)
    );
    
    const initialNotifications = unreadMemos.map(memo => {
        const lastActivity = memo.activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        const isForward = lastActivity?.action === 'forwarded' && memo.current_holderId === user.id;

        return {
            id: memo.id,
            memoId: memo.id,
            title: isForward ? 'Memo Delegated to You' : 'New Memo Received',
            description: `From: ${isForward && lastActivity.actor ? lastActivity.actor.name : memo.from.name} - ${memo.subject}`,
            createdAt: new Date(memo.createdAt),
            read: false,
        };
    });
    setNotifications(initialNotifications);
  }, []);

  const addNotification = useCallback((memo: MemoWithActivity, type?: string) => {
    if (!settings.notificationsEnabled) return;
    
    setNotifications(prev => {
        if (prev.some(n => n.id === memo.id)) {
            return prev;
        }
        
        const isForward = type === 'forward-memo';
        const isReply = type === 'reply-memo';

        let title: string;
        const fromName = memo.from.name;

        if (isForward) {
            title = 'Memo Forwarded to You';
        } else if (isReply) {
            title = 'You have a reply';
        } else {
            title = 'New Memo Received';
        }

        const newNotif = {
            id: memo.id,
            memoId: memo.id,
            title: title,
            description: `From: ${fromName} - ${memo.subject}`,
            createdAt: new Date(memo.createdAt),
            read: false,
        };

        if (settings.soundEnabled && audio) {
          audio.play().catch(error => console.error("Audio playback failed:", error));
        }
        toast(newNotif.title, { description: newNotif.description });

        return [newNotif, ...prev];
    });
  }, [settings.notificationsEnabled, settings.soundEnabled, audio]);

  const showNotification = useCallback((props: ShowNotificationProps) => {
    // This function is now mostly for generic, non-memo related toasts, but can be kept for that purpose.
    if (settings.soundEnabled && audio) {
      audio.play().catch(error => console.error("Audio playback failed:", error));
    }
    if (settings.notificationsEnabled) {
      toast(props.title, { description: props.description });
    }
  }, [settings, audio]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.length;

  return (
    <NotificationContext.Provider value={{ settings, setSettings, showNotification, addNotification, notifications, unreadCount, markAsRead, markAllAsRead, initializeNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
