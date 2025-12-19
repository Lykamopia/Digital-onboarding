'use client';

import {
  Archive,
  CheckCircle,
  Clock,
  Paperclip,
  Reply,
  Share2,
  User as UserIcon,
  Edit,
} from 'lucide-react';
import Link from 'next/link';
import type { MemoWithActivity } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatTimestamp } from '@/lib/data';
import { Badge } from '@/components/ui/badge';

interface MemoDisplayProps {
  memo: MemoWithActivity | null;
}

const actionIcons = {
  sent: <Share2 className="h-4 w-4" />,
  viewed: <CheckCircle className="h-4 w-4 text-blue-500" />,
  acknowledged: <CheckCircle className="h-4 w-4 text-green-500" />,
  commented: <Reply className="h-4 w-4" />,
  delegated: <Share2 className="h-4 w-4 text-purple-500" />,
  created: <Share2 className="h-4 w-4" />,
};

const UserDisplay = ({ user }: { user: { name: string; division: string; department: string; office: string; } }) => (
    <div className="grid grid-cols-[max-content_1fr] gap-x-2">
        <span className="font-semibold">{user.name}</span>
        <span className="text-muted-foreground">{`${user.division}, ${user.department}, ${user.office}`}</span>
    </div>
);


export function MemoDisplay({ memo }: MemoDisplayProps) {
  if (!memo) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>Select a memo to read</p>
          <p className="text-sm">or create a new one to get started.</p>
        </div>
      </Card>
    );
  }
  
  if (memo.status === 'draft') {
      return (
          <Card className="h-full flex flex-col items-center justify-center">
            <div className="text-center text-muted-foreground p-8">
              <h2 className="text-lg font-semibold text-foreground mb-2">This is a draft</h2>
              <p className="mb-4">You can continue editing this memo.</p>
              <Link href={`/dashboard/new?id=${memo.id}`}>
                  <Button>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Draft
                  </Button>
              </Link>
            </div>
          </Card>
      )
  }

  return (
    <Card className="h-full font-mono text-sm">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="font-headline text-xl mb-4">
                INTERNAL MEMORANDUM
                </CardTitle>
            </div>
             <div className="text-right text-xs text-muted-foreground">
                Ref: {memo.memo_reference_number}
             </div>
        </div>

        <Separator />
        
        <div className="space-y-2">
            <div className="grid grid-cols-[60px_1fr] items-start">
                <span className="font-semibold">DATE:</span>
                <span>{formatTimestamp(memo.createdAt)}</span>
            </div>
            <div className="grid grid-cols-[60px_1fr] items-start">
                <span className="font-semibold">FROM:</span>
                <UserDisplay user={memo.from} />
            </div>
            <div className="grid grid-cols-[60px_1fr] items-start">
                <span className="font-semibold">TO:</span>
                <div className="flex flex-col gap-1">
                    {memo.to.map((user) => <UserDisplay key={user.id} user={user} />)}
                </div>
            </div>
            {memo.cc.length > 0 && (
                 <div className="grid grid-cols-[60px_1fr] items-start">
                    <span className="font-semibold">CC:</span>
                    <div className="flex flex-col gap-1">
                        {memo.cc.map((user) => <UserDisplay key={user.id} user={user} />)}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-[60px_1fr] items-start">
                <span className="font-semibold">SUBJECT:</span>
                <span>{memo.subject}</span>
            </div>
        </div>
      </CardHeader>

      <CardContent>
        <Separator className="my-4" />
        <div className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap font-mono" dangerouslySetInnerHTML={{ __html: memo.body }} />

        {memo.attachments.length > 0 && (
          <>
            <Separator className="my-6" />
            <h3 className="text-sm font-medium mb-2 font-sans">Attachments</h3>
            <div className="flex flex-wrap gap-2">
              {memo.attachments.map((att) => (
                <Button key={att.id} variant="outline" size="sm" asChild className="font-sans">
                  <a href={att.url} download={att.name}>
                    <Paperclip className="h-4 w-4 mr-2" />
                    {att.name} ({att.size})
                  </a>
                </Button>
              ))}
            </div>
          </>
        )}

        <Separator className="my-6" />

        <div className="flex items-center gap-2 font-sans">
          <Button variant="outline">
            <CheckCircle className="mr-2 h-4 w-4" />
            Acknowledge
          </Button>
          <Button variant="outline">
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Delegate
          </Button>
          <Button variant="ghost" size="icon">
            <Archive className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <Separator className="my-6" />

        <div className="font-sans">
          <h3 className="text-sm font-medium mb-4">Activity History</h3>
          <ul className="space-y-4">
            {memo.activity.map((act) => (
              <li key={act.id} className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {actionIcons[act.action] || <UserIcon className="h-4 w-4" />}
                </span>
                <div className="flex-1 pt-1">
                  <p className="text-sm">
                    <span className="font-medium">{act.actor.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      {act.action} this memo.
                    </span>
                  </p>
                  {act.details && (
                    <p className="text-sm text-muted-foreground mt-1 pl-4 border-l-2 ml-2">
                      {act.details}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(act.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
