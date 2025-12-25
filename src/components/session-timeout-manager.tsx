
'use client';

import { signOut } from 'next-auth/react';
import { useIdleTimer } from '@/hooks/use-idle-timeout';

export function SessionTimeoutManager() {

  const handleLogout = () => {
    signOut({ callbackUrl: '/login?error=SessionExpired' });
  };
  
  useIdleTimer({
    onLogout: handleLogout,
  });

  return null;
}
