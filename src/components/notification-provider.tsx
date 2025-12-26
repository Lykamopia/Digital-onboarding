
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

type Notification = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  createdAt: Date;
  read: boolean;
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
  addNotificationToList: (props: ShowNotificationProps) => void;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

type NotificationSettings = {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const audioInstance = new Audio('/ring.mp3');
        audioInstance.load();
        setAudio(audioInstance);
    }
  }, []);
  
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

  const setSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettingsState(prev => {
      const updatedSettings = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('notification-settings', JSON.stringify(updatedSettings));
      }
      return updatedSettings;
    });
  };
  
  const addNotificationToList = useCallback((props: ShowNotificationProps) => {
    if (!settings.notificationsEnabled) return;
    
    setNotifications(prev => {
        const newNotif = {
            id: `notif-${Date.now()}-${Math.random()}`,
            title: props.title,
            description: props.description,
            createdAt: new Date(),
            read: false,
            memoId: props.memoId,
        };
        // Add new notification and prevent duplicates based on memoId
        const newNotifications = [newNotif, ...prev];
        const uniqueNotifications = newNotifications.filter((n, index, self) => 
            index === self.findIndex((t) => t.memoId === n.memoId) || !n.memoId
        );
        return uniqueNotifications;
    });
  }, [settings.notificationsEnabled]);

  const showNotification = useCallback((props: ShowNotificationProps) => {
    // Play sound if enabled
    if (settings.soundEnabled && audio) {
      audio.play().catch(error => console.error("Audio playback failed:", error));
    }
    
    // Add to list and show toast if visual notifications are enabled
    if (settings.notificationsEnabled) {
      toast(props.title, { description: props.description });
      addNotificationToList(props);
    }
  }, [settings, audio, addNotificationToList]);


  const markAsRead = useCallback((id: string) => {
    // Remove notification when read
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ settings, setSettings, showNotification, addNotificationToList, notifications, unreadCount, markAsRead, markAllAsRead }}>
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
