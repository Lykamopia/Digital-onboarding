
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';

const SESSION_TIMEOUT_KEY = 'session-timeout';
const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes

interface IdleTimerProps {
  onLogout: () => void;
}

export const useIdleTimer = ({ onLogout }: IdleTimerProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getTimeoutDuration = () => {
    const configuredMinutes = process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES;
    const timeoutMs = parseInt(configuredMinutes || '', 10) * 60 * 1000;
    return isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT : timeoutMs;
  };

  const logout = useCallback(() => {
    onLogout();
    localStorage.removeItem(SESSION_TIMEOUT_KEY);
  }, [onLogout]);


  const reset = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const timeoutDuration = getTimeoutDuration();

    // Set new final logout timer
    timeoutRef.current = setTimeout(logout, timeoutDuration);

    // Store the expiration time in local storage for cross-tab sync
    const expiration = new Date().getTime() + timeoutDuration;
    localStorage.setItem(SESSION_TIMEOUT_KEY, expiration.toString());
  }, [logout]);

  const handleStorageChange = useCallback((event: StorageEvent) => {
    if (event.key === SESSION_TIMEOUT_KEY && event.newValue) {
      // Another tab has reset the timer, so we should reset ours too.
      reset();
    }
  }, [reset]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    const handleActivity = () => reset();

    events.forEach(event => window.addEventListener(event, handleActivity));
    window.addEventListener('storage', handleStorageChange);

    // Initial setup
    reset();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      window.removeEventListener('storage', handleStorageChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reset, handleStorageChange]);

  return { reset };
};
