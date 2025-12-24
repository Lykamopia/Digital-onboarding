
"use client";

import { useEffect } from 'react';
import { useNotification } from '@/components/notification-provider';
import type { MemoWithActivity, User } from '@/lib/types';
import { getLoggedInUser } from '@/app/actions/memo';

export function NotificationListener() {
  const { showNotification } = useNotification();
  
  useEffect(() => {
    let loggedInUserId: string | null = null;
    getLoggedInUser().then(user => {
      if (user) {
        loggedInUserId = user.id;
      }
    });

    const handleMemoEvent = (event: Event) => {
      if (!loggedInUserId) return;

      const customEvent = event as CustomEvent;
      const { memo, recipientId, type } = customEvent.detail;
      
      if (recipientId !== loggedInUserId) {
        return;
      }
      
      let title = '';
      let description = '';

      if (type === 'new') {
        title = 'New Memo Received';
        description = `From: ${memo.from.name} - ${memo.subject}`;
      } else if (type === 'forward') {
        title = 'Memo Delegated to You';
        const forwarder = memo.activity[memo.activity.length-1]?.actor;
        description = `From: ${forwarder?.name || '...'} - ${memo.subject}`;
      }

      if (title) {
        showNotification({ title, description, memoId: memo.id });
      }
    };
    
    // These events are now triggered from server actions, so we can't listen to them on the client.
    // This component will now primarily handle displaying notifications pushed from the server
    // (e.g., via WebSockets in a real app). The logic for creating notifications
    // would be moved server-side. For this simulation, we'll leave the listeners but they may not fire.

    window.addEventListener('memoEvent', handleMemoEvent);

    return () => {
      window.removeEventListener('memoEvent', handleMemoEvent);
    };
  }, [showNotification]);

  return null;
}
