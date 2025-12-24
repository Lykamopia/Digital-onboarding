

'use client';

import * as React from 'react';
import {
  Archive,
  CheckCircle,
  Paperclip,
  Reply,
  Share2,
  Edit,
  Printer,
  Expand,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { MemoWithActivity, User, Attachment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatTimestamp } from '@/lib/data';
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
import { acknowledgeMemo, archiveMemo, forwardMemo, getLoggedInUser, getUsers } from '@/app/actions/memo';
import { StatusBadge } from './status-badge';
import { MemoEmptyIllustration } from './memo-empty-illustration';

const actionIcons: { [key: string]: React.ReactNode } = {
  sent: <CheckCircle className="h-4 w-4 text-green-500" />,
  viewed: <CheckCircle className="h-4 w-4 text-blue-500" />,
  acknowledged: <CheckCircle className="h-4 w-4 text-green-500" />,
  commented: <Reply className="h-4 w-4" />,
  forwarded: <Share2 className="h-4 w-4 text-purple-500" />,
  created: <Edit className="h-4 w-4" />,
  archived: <Archive className="h-4 w-4" />,
  unarchived: <Undo2 className="h-4 w-4" />,
};

function ForwardDialog({ memo, onUpdate }: { memo: MemoWithActivity, onUpdate: () => void }) {
  const [selectedUser, setSelectedUser] = React.useState<User[]>([]);
  const [remark, setRemark] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    getUsers().then(setAllUsers);
  }, []);

  const handleForward = async () => {
    if (selectedUser.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No user selected',
        description: 'Please select a user to forward the memo to.',
      });
      return;
    }
    const forwardTo = selectedUser[0];

    await forwardMemo(memo.id, forwardTo.id, remark);

    toast({
        title: "Memo Forwarded",
        description: `Successfully forwarded to ${forwardTo.name}.`
    });
    onUpdate();
    setOpen(false);
    setSelectedUser([]);
    setRemark('');
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
              allUsers={allUsers}
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
  const [loggedInUser, setLoggedInUser] = React.useState<(User & { role: { permissions: string[] } }) | null>(null);

  React.useEffect(() => {
    getLoggedInUser().then(user => setLoggedInUser(user as any));
  }, []);
  
  const handlePrint = () => {
    window.print();
  }

  const handleAcknowledge = async () => {
    if (!memo) return;
    await acknowledgeMemo(memo.id);
    toast({
        title: "Memo Acknowledged",
        description: "You have acknowledged receipt of this memo."
    });
    onUpdate();
  }

  const handleArchive = async () => {
    if (!memo) return;
    await archiveMemo(memo.id, true);
    toast({
        title: "Memo Archived",
        description: "The memo has been moved to your archive."
    });
    onUpdate();
  }

  const handleUnarchive = async () => {
    if (!memo) return;
    await archiveMemo(memo.id, false);
    toast({
        title: "Memo Unarchived",
        description: "The memo has been restored from your archive."
    });
    onUpdate();
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
  
  const isCC = loggedInUser && memo.cc.some(u => u.id === loggedInUser.id);
  const isRecipient = loggedInUser && (memo.to.some(u => u.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id);
  const hasAcknowledged = loggedInUser && memo.acknowledgedBy?.some(u => u.id === loggedInUser.id);
  const canAcknowledge = !hasAcknowledged && isRecipient && !isCC;
  const canForward = isRecipient && !isCC;
  const isArchived = loggedInUser && memo.archivedBy?.some(u => u.id === loggedInUser.id);

  const MemoContent = () => (
    <div className={`font-serif text-sm printable-memo-container ${!isPreview ? 'bg-card' : ''}`}>
        <div className="printable-memo bg-white p-8 max-w-4xl mx-auto my-8 shadow-lg">
            <CardHeader className="p-0 printable-memo-header">
                <div className="flex flex-col items-center justify-center mb-6">
                    <Image src="/Wide - LOGO.png" alt="Nib International Bank" width={300} height={100} className="object-contain" />
                    <div className='text-center mt-4'>
                        <p className="text-xl font-bold tracking-wider">MEMORANDUM</p>
                    </div>
                </div>
                <div className="border-t-4 border-b-4 border-double border-black">
                     <MemoField label="Date" amharic="ቀን">
                        {formatTimestamp(memo.createdAt, false)}
                    </MemoField>
                    <MemoField label="From" amharic="ከ">
                        <div>
                            <div className='font-semibold'>{memo.from.name}</div>
                        </div>
                    </MemoField>
                    <MemoField label="To" amharic="ለ">
                        <div className="flex flex-col gap-1 font-sans">
                            {memo.to.map((user) => (
                                <div key={user.id} className="flex items-center gap-2">
                                    <span>{user.name}</span>
                                    {memo.acknowledgedBy?.some(u => u.id === user.id) && (
                                        <StatusBadge status="acknowledged" />
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
                        {isArchived ? (
                            <Button variant="ghost" size="icon" onClick={handleUnarchive} title="Unarchive">
                                <Undo2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        ) : (
                            <Button variant="ghost" size="icon" onClick={handleArchive} title="Archive">
                                <Archive className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                        </div>
                        <Separator className="my-6 no-print" />

                        <div className="font-sans no-print">
                        <h3 className="text-sm font-medium mb-4">Activity History</h3>
                        <ul className="space-y-4">
                            {memo.activity.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((act) => (
                            <li key={act.id} className="flex items-start gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={(act.actor as User).avatar} alt={(act.actor as User).name} />
                                    <AvatarFallback>{(act.actor as User).name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                </span>
                                <div className="flex-1">
                                <p className="text-sm">
                                    <span className="font-medium">{(act.actor as User).name}</span>
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
            <div className="flex items-center gap-2 overflow-hidden">
                <CardTitle className="text-base truncate">{memo.subject}</CardTitle>
            </div>
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
