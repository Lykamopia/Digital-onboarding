
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_TIMEOUT_KEY = 'session-timeout';
const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 1 * 60 * 1000; // 1 minute before timeout

interface IdleTimerProps {
  onIdle: () => void;
  onLogout: () => void;
}

export const useIdleTimer = ({ onIdle, onLogout }: IdleTimerProps) => {
  const [remaining, setRemaining] = useState(WARNING_TIME);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getTimeoutDuration = () => {
    const configuredMinutes = process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES;
    const timeoutMs = parseInt(configuredMinutes || '', 10) * 60 * 1000;
    return isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT : timeoutMs;
  };

  const logout = useCallback(() => {
    onLogout();
    localStorage.removeItem(SESSION_TIMEOUT_KEY);
  }, [onLogout]);

  const startWarningCountdown = useCallback(() => {
    setRemaining(WARNING_TIME);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  }, []);

  const reset = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const timeoutDuration = getTimeoutDuration();

    // Set new warning timer
    warningTimeoutRef.current = setTimeout(() => {
      onIdle();
      startWarningCountdown();
    }, timeoutDuration - WARNING_TIME);

    // Set new final logout timer
    timeoutRef.current = setTimeout(logout, timeoutDuration);

    // Store the expiration time in local storage for cross-tab sync
    const expiration = new Date().getTime() + timeoutDuration;
    localStorage.setItem(SESSION_TIMEOUT_KEY, expiration.toString());
  }, [onIdle, logout, startWarningCountdown]);

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
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [reset, handleStorageChange]);

  return { getRemainingTime: () => remaining, reset };
};
