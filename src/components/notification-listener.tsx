"use client";

import { useEffect } from 'react';
import { useNotification } from '@/components/notification-provider';
import type { MemoWithActivity } from '@/lib/types';
import { loggedInUser } from '@/lib/data';

export function NotificationListener() {
  const { showNotification } = useNotification();

  useEffect(() => {
    const handleMemoEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { memo, recipientId, type } = customEvent.detail;
      
      if (recipientId !== loggedInUser.id) {
        return;
      }
      
      let title = '';
      let description = '';

      if (type === 'new') {
        title = 'New Memo Received';
        description = `From: ${memo.from.name} - ${memo.subject}`;
      } else if (type === 'forward') {
        title = 'Memo Delegated to You';
        description = `From: ${memo.activity[memo.activity.length-1].actor.name} - ${memo.subject}`;
      }

      if (title) {
        showNotification({ title, description });
      }
    };
    
    const handleMemoSent = (event: Event) => {
        const { memo } = (event as CustomEvent).detail;
        memo.to.forEach((user:any) => {
            handleMemoEvent(new CustomEvent('memoEvent', { detail: { memo, recipientId: user.id, type: 'new' } }));
        });
        memo.cc.forEach((user:any) => {
            handleMemoEvent(new CustomEvent('memoEvent', { detail: { memo, recipientId: user.id, type: 'new' } }));
        });
    }

    const handleMemoForwarded = (event: Event) => {
        const { memo, recipientId } = (event as CustomEvent).detail;
        handleMemoEvent(new CustomEvent('memoEvent', { detail: { memo, recipientId, type: 'forward' } }));
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'memos' && event.newValue) {
        const oldMemos: MemoWithActivity[] = event.oldValue ? JSON.parse(event.oldValue) : [];
        const newMemos: MemoWithActivity[] = JSON.parse(event.newValue);
        
        const newMemo = newMemos.find(
          (newM) => !oldMemos.some((oldM) => oldM.id === newM.id) && 
                      (newM.to.some(u => u.id === loggedInUser.id) || newM.cc.some(u => u.id === loggedInUser.id))
        );

        if (newMemo) {
            handleMemoEvent(new CustomEvent('memoEvent', { detail: { memo: newMemo, recipientId: loggedInUser.id, type: 'new' } }));
        }

        newMemos.forEach(newM => {
            const oldM = oldMemos.find(om => om.id === newM.id);
            if (oldM && newM.current_holder?.id === loggedInUser.id && oldM.current_holder?.id !== loggedInUser.id) {
                handleMemoEvent(new CustomEvent('memoEvent', { detail: { memo: newM, recipientId: loggedInUser.id, type: 'forward' } }));
            }
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('memoSent', handleMemoSent);
    window.addEventListener('memoForwarded', handleMemoForwarded);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('memoSent', handleMemoSent);
      window.removeEventListener('memoForwarded', handleMemoForwarded);
    };
  }, [showNotification]);

  return null;
}
