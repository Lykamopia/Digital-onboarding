
'use client';

import * as React from 'react';
import {
  Archive,
  CheckCircle,
  Paperclip,
  Reply,
  Share2,
  Edit,
  Send,
  Printer,
  Expand,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { MemoWithActivity, User, Attachment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatTimestamp, loggedInUser } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { RecipientSelector } from './recipient-selector';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from './empty-state';
import { Badge } from './ui/badge';

const actionIcons: { [key: string]: React.ReactNode } = {
  sent: <Send className="h-4 w-4" />,
  viewed: <CheckCircle className="h-4 w-4 text-blue-500" />,
  acknowledged: <CheckCircle className="h-4 w-4 text-green-500" />,
  commented: <Reply className="h-4 w-4" />,
  forwarded: <Share2 className="h-4 w-4 text-purple-500" />,
  created: <Edit className="h-4 w-4" />,
  archived: <Archive className="h-4 w-4" />,
};

const UserDisplay = ({
  user,
  showDetails = true,
}: {
  user: User | undefined;
  showDetails?: boolean;
}) => {
    if (!user) return null;
    return (
        <div>
            <span>{user.name}</span>
            {showDetails && <span className="text-muted-foreground text-xs block">{`${user.division}, ${user.department}, ${user.office}`}</span>}
        </div>
    )
};

function ForwardDialog({ memo, onUpdate }: { memo: MemoWithActivity, onUpdate: () => void }) {
  const [selectedUser, setSelectedUser] = React.useState<User[]>([]);
  const [remark, setRemark] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();

  const handleForward = () => {
    if (selectedUser.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No user selected',
        description: 'Please select a user to forward the memo to.',
      });
      return;
    }
    const forwardTo = selectedUser[0];

    const newActivity = {
      id: `act-${Date.now()}`,
      actor: loggedInUser,
      action: 'forwarded' as const,
      timestamp: new Date().toISOString(),
      details: `Forwarded from ${loggedInUser.name} to ${forwardTo.name}.${remark ? `\n<b>Remark:</b> ${remark}` : ''}`,
    };
    
    const updatedMemo = {
        ...memo,
        current_holder: forwardTo,
        previous_holders: [...(memo.previous_holders || []), memo.current_holder].filter(Boolean) as User[],
        activity: [...memo.activity, newActivity],
    };

    const memos: MemoWithActivity[] = JSON.parse(localStorage.getItem('memos') || '[]');
    const memoIndex = memos.findIndex(m => m.id === memo.id);
    if(memoIndex > -1) {
        memos[memoIndex] = updatedMemo;
        localStorage.setItem('memos', JSON.stringify(memos));
        
        // Dispatch event for notification
        window.dispatchEvent(new CustomEvent('memoForwarded', { detail: { memo: updatedMemo, recipientId: forwardTo.id } }));

        toast({
            title: "Memo Forwarded",
            description: `Successfully forwarded to ${forwardTo.name}.`
        });
        onUpdate();
        setOpen(false);
        setSelectedUser([]);
        setRemark('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className='no-print'>
          <Share2 className="mr-2 h-4 w-4" />
          Forward
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward Memo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Forward to</p>
            <RecipientSelector
              selected={selectedUser}
              setSelected={(users) => setSelectedUser(users.slice(0, 1))}
              placeholder="Select a user..."
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Remark (Optional)</p>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add a remark..."
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleForward}>Forward</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MemoField = ({ label, amharic, children, className }: { label: string, amharic: string, children: React.ReactNode, className?: string }) => {
    return (
        <div className={`grid grid-cols-[120px_1fr] border-b border-black ${className}`}>
            <div className="font-semibold text-sm border-r border-black p-2 flex flex-col justify-center text-right">
                <span>{label}</span>
                <span className="text-xs">{amharic}</span>
            </div>
            <div className="p-2 flex items-center">{children}</div>
        </div>
    );
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function MemoDisplay({ memo, onUpdate, isPreview = false }: MemoDisplayProps) {
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    if (memo && !isPreview) {
      const isRecipient = memo.to.some(user => user.id === loggedInUser.id) || memo.cc.some(user => user.id === loggedInUser.id);
      const hasViewed = memo.activity.some(act => act.actor.id === loggedInUser.id && act.action === 'viewed');

      if (isRecipient && !hasViewed) {
         const newActivity = {
            id: `act-${Date.now()}-view`,
            actor: loggedInUser,
            action: 'viewed' as const,
            timestamp: new Date().toISOString(),
            details: 'Viewed the memo.'
          };

          const updatedMemo = {
            ...memo,
            activity: [...memo.activity, newActivity],
          };
          updateMemoInStorage(updatedMemo, false);
      }
    }
  }, [memo, isPreview, onUpdate]);

  const handlePrint = () => {
    window.print();
  }

  const updateMemoInStorage = (updatedMemo: MemoWithActivity, showToast = true) => {
    const memos: MemoWithActivity[] = JSON.parse(localStorage.getItem('memos') || '[]');
    const memoIndex = memos.findIndex(m => m.id === updatedMemo.id);
    if (memoIndex > -1) {
        memos[memoIndex] = updatedMemo;
    } else {
        const initialMemos: MemoWithActivity[] = JSON.parse(JSON.stringify(require('@/lib/data').memos));
        const initialMemoIndex = initialMemos.findIndex(m => m.id === updatedMemo.id);
        if(initialMemoIndex > -1) {
             memos.push(updatedMemo);
        } else {
            console.error("Could not find memo to update")
            return false;
        }
    }
    localStorage.setItem('memos', JSON.stringify(memos));
    onUpdate();
    return true;
  }

  const handleAcknowledge = () => {
    if (!memo) return;

    const newActivity = {
      id: `act-${Date.now()}`,
      actor: loggedInUser,
      action: 'acknowledged' as const,
      timestamp: new Date().toISOString(),
      details: 'Acknowledged receipt of the memo.',
    };

    const newAcknowledgedBy = [...(memo.acknowledgedBy || []), loggedInUser.id];
    
    // Determine if all recipients have acknowledged
    const allAcknowledged = memo.to.every(recipient => newAcknowledgedBy.includes(recipient.id));

    const updatedMemo = {
      ...memo,
      acknowledgedBy: newAcknowledgedBy,
      status: allAcknowledged ? 'acknowledged' as const : memo.status,
      activity: [...memo.activity, newActivity],
    };
    
    if (updateMemoInStorage(updatedMemo)) {
        toast({
            title: "Memo Acknowledged",
            description: "You have acknowledged receipt of this memo."
        });
    }
  }

  const handleArchive = () => {
    if (!memo) return;
    const newActivity = {
        id: `act-${Date.now()}`,
        actor: loggedInUser,
        action: 'archived' as const,
        timestamp: new Date().toISOString(),
        details: 'Archived the memo.',
    };
    const updatedMemo = {
        ...memo,
        archivedBy: [...(memo.archivedBy || []), loggedInUser.id],
        activity: [...memo.activity, newActivity],
    };
     if (updateMemoInStorage(updatedMemo)) {
        toast({
            title: "Memo Archived",
            description: "The memo has been moved to your archive."
        });
    }
  }

  const handleReply = () => {
    if(!memo) return;
    router.push(`/dashboard/new?replyTo=${memo.id}`);
  }

  if (!memo) {
    return (
        <div className="h-full p-2">
          <EmptyState 
            title="Select a memo"
            description="Select a memo from the list to read its content."
          />
        </div>
    );
  }

  if (memo.status === 'draft' && !isPreview) {
    return (
      <div className="h-full p-2">
        <EmptyState
            icon={<Edit className="h-16 w-16 text-muted-foreground/50" />}
            title="This is a draft"
            description="You can continue editing this memo or send it."
            action={
                <Link href={`/dashboard/new?id=${memo.id}`}>
                    <Button>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Draft
                    </Button>
                </Link>
            }
        />
      </div>
    );
  }
  
  const isCC = memo.cc.some(u => u.id === loggedInUser.id);
  const isRecipient = memo.to.some(u => u.id === loggedInUser.id);
  const hasAcknowledged = memo.acknowledgedBy?.includes(loggedInUser.id);
  const canAcknowledge = !hasAcknowledged && isRecipient && !isCC;
  const canForward = isRecipient && !isCC;


  const MemoContent = () => (
    <div className={`font-serif text-sm printable-memo-container ${!isPreview ? 'bg-card' : ''}`}>
        <div className="printable-memo bg-white p-8 max-w-4xl mx-auto my-8 shadow-lg">
            <CardHeader className="p-0 printable-memo-header">
                <div className="flex items-center justify-between mb-6">
                    <Image src="/Wide - LOGO.png" alt="Nib International Bank" width={300} height={100} className="object-contain" data-ai-hint="logo" />
                    <div className='text-right'>
                        <p className="text-xl font-bold tracking-wider">MEMORANDUM</p>
                        <p className="text-sm mt-1">{memo.memo_reference_number}</p>
                    </div>
                </div>
                <div className="border-t-4 border-b-4 border-double border-black">
                     <MemoField label="Date" amharic="ቀን">
                        {formatTimestamp(memo.createdAt, false)}
                    </MemoField>
                    <MemoField label="From" amharic="ከ">
                        <div>
                            <div className='font-semibold'>{memo.from.name}</div>
                            <div className="text-xs">{`${memo.from.office}, ${memo.from.department}`}</div>
                        </div>
                    </MemoField>
                    <MemoField label="To" amharic="ለ">
                        <div className="flex flex-col gap-1 font-sans">
                            {memo.to.map((user) => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <span>{user.name} - <span className='text-xs'>{user.department}</span></span>
                                    {memo.acknowledgedBy?.includes(user.id) && (
                                        <Badge variant="secondary" className="text-xs font-mono bg-green-100 text-green-800">Acknowledged</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </MemoField>
                    
                    {memo.cc.length > 0 && (
                        <MemoField label="CC" amharic="ግልባጭ">
                            <div className="flex flex-col gap-2">
                                {memo.cc.map((user) => (
                                    <div key={user.id}>{user.name}</div>
                                ))}
                            </div>
                        </MemoField>
                    )}
                    <MemoField label="Subject" amharic="ጉዳዩ">
                        <span className="font-medium underline">{memo.subject}</span>
                    </MemoField>
                    <MemoField label="Enc" amharic="አባሪ" className='border-b-0'>
                         {memo.attachments.length > 0 ? (
                            <div className="flex flex-col gap-1 font-sans">
                                {memo.attachments.map(att => (
                                <a key={att.id} href={att.url} download={att.name} className="flex items-center gap-2 text-blue-600 hover:underline">
                                    <Paperclip className='h-4 w-4' />
                                    {att.name} ({formatFileSize(att.size)})
                                </a>
                                ))}
                            </div>
                        ) : (
                            <span>.</span>
                        )}
                    </MemoField>
                </div>
                
            </CardHeader>

            <CardContent className='pt-6 printable-memo-content'>
                <div
                className="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap font-serif text-black word-break-break-word"
                dangerouslySetInnerHTML={{ __html: memo.body }}
                />

                { !isPreview && (
                    <>
                        <Separator className="my-6 no-print" />
                        <div className="flex items-center gap-2 font-sans no-print">
                        {canAcknowledge && 
                            <Button variant="outline" onClick={handleAcknowledge}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Acknowledge
                            </Button>
                        }
                        <Button variant="outline" onClick={handleReply}>
                            <Reply className="mr-2 h-4 w-4" />
                            Reply
                        </Button>
                        {canForward && (
                            <ForwardDialog memo={memo} onUpdate={onUpdate} />
                        )}
                        <div className="flex-grow" />
                        <Button variant="ghost" size="icon" onClick={handlePrint}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleArchive}>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        </div>
                        <Separator className="my-6 no-print" />

                        <div className="font-sans no-print">
                        <h3 className="text-sm font-medium mb-4">Activity History</h3>
                        <ul className="space-y-4">
                            {memo.activity.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((act) => (
                            <li key={act.id} className="flex items-start gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={act.actor.avatar} alt={act.actor.name} />
                                    <AvatarFallback>{act.actor.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                </span>
                                <div className="flex-1">
                                <p className="text-sm">
                                    <span className="font-medium">{act.actor.name}</span>
                                    <span className="text-muted-foreground">
                                    {' '}
                                    {act.action} this memo.
                                    </span>
                                </p>
                                {act.details && (
                                    <div className="text-sm text-muted-foreground mt-1 pl-4 border-l-2 ml-2" dangerouslySetInnerHTML={{__html: act.details.replace(/\n/g, '<br/>')}}/>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatTimestamp(act.timestamp)}
                                </p>
                                </div>
                            </li>
                            ))}
                        </ul>
                        </div>
                    </>
                )}
            </CardContent>
        </div>
    </div>
  );

  return (
    <Card className="h-full flex flex-col" id={!isPreview ? 'memo-content-wrapper' : ''}>
        <CardHeader className="flex flex-row items-center justify-between no-print border-b p-4">
            <CardTitle className="text-base truncate">{memo.subject}</CardTitle>
            {!isPreview && (
                 <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Expand className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0">
                        <DialogHeader className="p-4 border-b">
                            <DialogTitle>Full Memo View</DialogTitle>
                        </DialogHeader>
                        <div className="overflow-y-auto flex-1">
                            <MemoContent />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </CardHeader>
        <div className="flex-1 overflow-y-auto">
            <MemoContent />
        </div>
    </Card>
  );
}

interface MemoDisplayProps {
  memo: MemoWithActivity | null;
  onUpdate: () => void;
  isPreview?: boolean;
}
