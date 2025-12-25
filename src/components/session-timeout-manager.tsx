
'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useIdleTimer } from '@/hooks/use-idle-timeout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from './ui/button';
import { LogOut, Timer } from 'lucide-react';

export function SessionTimeoutManager() {
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  const handleIdle = () => {
    setIsWarningOpen(true);
  };

  const handleLogout = () => {
    setIsWarningOpen(false);
    signOut({ callbackUrl: '/login' });
  };
  
  const { getRemainingTime, reset } = useIdleTimer({
    onIdle: handleIdle,
    onLogout: handleLogout,
  });

  const handleStay = () => {
    setIsWarningOpen(false);
    reset();
  };

  const remainingSeconds = Math.round(getRemainingTime() / 1000);

  return (
    <AlertDialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            <Timer className="h-6 w-6" />
            Are you still there?
          </AlertDialogTitle>
          <AlertDialogDescription>
            For your security, you will be logged out in {remainingSeconds} seconds due to inactivity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button onClick={handleStay}>Stay Logged In</Button>
          </AlertDialogAction>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out Now
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
