
'use client';

import { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RecipientSelector } from './recipient-selector';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { forwardMemo, getUsers } from '@/app/actions/memo';
import type { MemoWithActivity, User } from '@/lib/types';
import Logo from './logo';

interface ForwardDialogProps {
  memo: MemoWithActivity;
  onUpdate: () => void;
  children: React.ReactNode;
}

function ForwardMemoIllustration() {
    return (
        <div className="absolute top-4 right-4 text-accent/20">
            <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-24 w-24 -rotate-12 opacity-50"
            >
                <path
                d="M105 15 L25 50 L45 55 L58 95 L65 85 L60 58 Z"
                fill="currentColor"
                stroke="hsl(var(--accent-foreground))"
                strokeWidth="1"
                strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

export function ForwardDialog({ memo, onUpdate, children }: ForwardDialogProps) {
  const [selectedUser, setSelectedUser] = useState<User[]>([]);
  const [remark, setRemark] = useState('');
  const [open, setOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      getUsers().then(setAllUsers);
    }
  }, [open]);

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
      title: 'Memo Forwarded',
      description: `Successfully forwarded to ${forwardTo.name}.`,
    });
    onUpdate();
    setOpen(false);
    setSelectedUser([]);
    setRemark('');
  };

  const closeDialog = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(false);
    setSelectedUser([]);
    setRemark('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className='relative pr-24'>
            <div className="mb-4">
              <Logo hideText />
            </div>
            <DialogTitle className="text-2xl flex items-center gap-2">
                <Share2 /> Forward Memo
            </DialogTitle>
            <DialogDescription className="mt-2">
                Delegate or share this memo with another user. They will become the new current holder.
            </DialogDescription>
            <ForwardMemoIllustration />
          </div>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6 py-4">
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
              placeholder="Add a remark... e.g., 'FYI' or 'Please handle this.'"
              className="h-full"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleForward}>
            <Share2 className="mr-2" />
            Confirm Forward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
