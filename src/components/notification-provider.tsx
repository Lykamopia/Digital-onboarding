
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Toast } from '@/hooks/use-toast';

type Notification = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  createdAt: Date;
  read: boolean;
  memoId?: string;
};

type ShowNotificationProps = Omit<Toast, 'id'> & { memoId?: string };

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
  const { toast } = useToast();
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

  const showNotification = useCallback(({ memoId, ...props }: ShowNotificationProps) => {
    if (settings.notificationsEnabled) {
      toast(props);
      setNotifications(prev => [
        { 
          id: `notif-${Date.now()}`,
          title: props.title || '',
          description: props.description,
          createdAt: new Date(),
          read: false,
          memoId: memoId,
        }, 
        ...prev
      ]);
      if (settings.soundEnabled && audio) {
        audio.play().catch(error => console.error("Audio playback failed:", error));
      }
    }
  }, [settings, toast, audio]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
