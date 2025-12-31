
'use client';

import { cn } from '@/lib/utils';
import type { Memo } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: Memo['status'] | 'unread' | 'read' | 'forwarded';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusStyles: Record<typeof status, string> = {
    draft: 'bg-yellow-100/60 text-yellow-800 border-yellow-200/80 hover:bg-yellow-100/80 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-800/60',
    sent: 'bg-blue-100/60 text-blue-800 border-blue-200/80 hover:bg-blue-100/80 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800/60',
    read: 'bg-gray-100/60 text-gray-800 border-gray-200/80 hover:bg-gray-100/80 dark:bg-gray-900/40 dark:text-gray-200 dark:border-gray-800/60',
    unread: 'bg-green-100/60 text-green-800 border-green-200/80 hover:bg-green-100/80 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800/60',
    acknowledged: 'bg-purple-100/60 text-purple-800 border-purple-200/80 hover:bg-purple-100/80 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800/60',
    forwarded: 'bg-indigo-100/60 text-indigo-800 border-indigo-200/80 hover:bg-indigo-100/80 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800/60',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize text-xs font-medium',
        statusStyles[status] || 'bg-gray-100 text-gray-800'
      )}
    >
      {status}
    </Badge>
  );
}
