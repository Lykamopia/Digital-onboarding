
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RecipientSelector } from './recipient-selector';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getLoggedInUser, getUsers } from '@/app/actions/memo';
import type { MemoWithActivity, User } from '@/lib/types';
import Logo from './logo';
import { Label } from './ui/label';
import { useRouter } from 'next/navigation';

interface AssignDialogProps {
  memo: MemoWithActivity;
  onUpdate: () => void;
  children: React.ReactNode;
}

function AssignMemoIllustration() {
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

export function ForwardDialog({ memo, onUpdate, children }: AssignDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [remark, setRemark] = useState('');
  const [open, setOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();
  const router = useRouter();


  useEffect(() => {
    if (open) {
      Promise.all([getUsers(), getLoggedInUser()]).then(([users, loggedInUser]) => {
        setAllUsers(users);
        setCurrentUser(loggedInUser);
      });
    }
  }, [open]);

  const availableUsers = useMemo(() => {
    if (!currentUser) return [];
    
    const existingRecipientIds = new Set([
        memo.fromId,
        memo.current_holderId,
        ...memo.to.map(u => u.id),
        ...memo.cc.map(u => u.id),
        ...memo.previous_holders?.map(u => u.id) || [],
        currentUser.id, // Exclude self
    ]);

    // Requirement: Filter to only include active users
    return allUsers.filter(u => !existingRecipientIds.has(u.id) && u.status === 'active');
  }, [allUsers, currentUser, memo]);


  const closeDialog = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(false);
    setSelectedUsers([]);
    setRemark('');
  }

  const handleAssign = () => {
    setIsAssigning(true);
    // Create query params for the new memo page
    const params = new URLSearchParams();
    params.set('assignFrom', memo.id);
    selectedUsers.forEach(user => params.append('to[]', user.id));
    if (remark) {
        params.set('remark', remark);
    }
    
    // Navigate to the compose page
    router.push(`/dashboard/new?${params.toString()}`);

    // Close the dialog and show toast
    toast({ title: "Assigning Memo", description: "You are now composing an assignment." });
    closeDialog();
    setIsAssigning(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Assign Memo</DialogTitle>
          <div className='relative pr-24'>
            <div className="mb-4">
              <Logo hideText />
            </div>
            <div className="text-2xl font-bold flex items-center gap-2">
                <Share2 /> Assign Memo
            </div>
            <DialogDescription className="mt-2">
                Assign this memo to other users.
            </DialogDescription>
            <AssignMemoIllustration />
          </div>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="assign-to">Assign to</Label>
            <RecipientSelector
              id="assign-to"
              allUsers={availableUsers}
              selected={selectedUsers}
              setSelected={setSelectedUsers}
              placeholder="Select one or more users..."
              popoverClassName="z-[51]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remark">Remark (Optional)</Label>
            <Textarea
              id="remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add a remark... e.g., 'FYI' or 'Please handle this.'"
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleAssign} disabled={selectedUsers.length === 0 || isAssigning}>
            {isAssigning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-2" />
            )}
            {isAssigning ? 'Preparing...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
