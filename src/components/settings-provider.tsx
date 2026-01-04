
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getGeneralSettings, saveGeneralSettings } from '@/app/actions/memo';
import type { AcknowledgementType } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

type GeneralSettings = {
  acknowledgementType: AcknowledgementType;
};

type SettingsContextType = {
  settings: GeneralSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<GeneralSettings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GeneralSettings>({ acknowledgementType: 'SIGNATURE' });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await getGeneralSettings();
      setSettings(data);
    } catch (error) {
      console.error("Failed to fetch general settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Listen for changes from other tabs/windows if needed, e.g., via BroadcastChannel
  }, [fetchSettings]);

  const updateSettings = async (newSettings: Partial<GeneralSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings); // Optimistic update
    try {
      await saveGeneralSettings(updatedSettings);
      // Optional: broadcast change to other tabs
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } catch (error) {
      console.error("Failed to save settings:", error);
      // Revert on failure
      fetchSettings();
    }
  };
  
  useEffect(() => {
    const handleSettingsUpdate = () => fetchSettings();
    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, [fetchSettings]);

  const value = { settings, loading, updateSettings };

  return (
    <SettingsContext.Provider value={value}>
      {loading ? <div className="h-screen w-full flex items-center justify-center bg-background"><Skeleton className="h-full w-full" /></div> : children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
