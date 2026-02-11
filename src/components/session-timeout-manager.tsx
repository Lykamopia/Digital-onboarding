
'use client';

import { signOut } from 'next-auth/react';
import { useIdleTimer } from '@/hooks/use-idle-timeout';

export function SessionTimeoutManager({ disabled = false }: { disabled?: boolean }) {

  const handleLogout = () => {
    signOut({ callbackUrl: '/login?error=SessionExpired' });
  };
  
  useIdleTimer({
    onLogout: handleLogout,
    disabled: disabled
  });

  return null;
}
