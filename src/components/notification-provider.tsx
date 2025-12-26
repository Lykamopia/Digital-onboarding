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
    variant: 'success' | 'error' | 'info' | 'warning';
} & { memoId?: string };

type NotificationContextType = {
  settings: NotificationSettings;
  setSettings: (settings: Partial<NotificationSettings>) => void;
  showNotification: (props: ShowNotificationProps) => void;
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

  const showNotification = useCallback(({ memoId, title, description, variant }: ShowNotificationProps) => {
    // Play sound if it's enabled, regardless of visual notifications
    if (settings.soundEnabled && audio) {
      audio.play().catch(error => console.error("Audio playback failed:", error));
    }
    
    // Show visual toast and add to list only if notifications are enabled
    if (settings.notificationsEnabled) {
      switch(variant) {
        case 'success':
            toast.success(title, { description });
            break;
        case 'error':
            toast.error(title, { description });
            break;
        case 'warning':
            toast.warning(title, { description });
            break;
        case 'info':
            toast.info(title, { description });
            break;
        default:
            toast(title, { description });
            break;
      }
      
      setNotifications(prev => [
        { 
          id: `notif-${Date.now()}`,
          title,
          description,
          createdAt: new Date(),
          read: false,
          memoId: memoId,
        }, 
        ...prev
      ].filter((n, index, self) => index === self.findIndex((t) => t.memoId === n.memoId) || !n.memoId)); // Prevent duplicates
    }
  }, [settings, audio]);

  const markAsRead = useCallback((id: string) => {
    // Remove notification when read
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ settings, setSettings, showNotification, notifications, unreadCount, markAsRead, markAllAsRead }}>
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
