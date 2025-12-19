'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Send, Trash2, DraftingCompass, Eye } from 'lucide-react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { RecipientSelector } from '@/components/recipient-selector';
import type { User, Memo, Activity, MemoWithActivity } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loggedInUser, users, formatTimestamp } from '@/lib/data';
import { Editor } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MemoDisplay } from '@/components/memo-display';

const memoSchema = z.object({
  id: z.string().optional(),
  to: z.array(z.any()).min(1, 'Please select at least one recipient.'),
  cc: z.array(z.any()).optional(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
});

type MemoFormData = z.infer<typeof memoSchema>;

const DRAFT_KEY = 'memo-draft';

const MemoPreview = ({ memoData }: { memoData: MemoWithActivity | null }) => {
  if (!memoData) return null;
  return <MemoDisplay memo={memoData} onUpdate={() => {}} isPreview />;
};

export default function NewMemoPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<MemoFormData>({
    resolver: zodResolver(memoSchema),
    defaultValues: {
      to: [],
      cc: [],
      subject: '',
      body: '',
    },
  });

  const currentFormData = form.watch();

  const previewMemo: MemoWithActivity = {
    id: 'preview',
    memo_reference_number: 'MEMO-XXXX-XXX',
    from: loggedInUser,
    to: currentFormData.to?.map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[] || [],
    cc: currentFormData.cc?.map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[] || [],
    subject: currentFormData.subject || '',
    body: currentFormData.body || '',
    attachments: [],
    createdAt: new Date().toISOString(),
    status: 'draft',
    activity: [],
  };

  const saveDraft = useCallback((data: MemoFormData) => {
    if (typeof window === 'undefined') return;
    setIsSaving(true);

    const draft: Memo = {
      id: `draft-${loggedInUser.id}`,
      memo_reference_number: 'DRAFT',
      from: loggedInUser,
      to: data.to.map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[],
      cc: (data.cc || []).map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[],
      subject: data.subject,
      body: data.body,
      createdAt: new Date().toISOString(),
      status: 'draft',
      attachments: [],
    };
    
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setIsDraft(true);
    
    setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date().toLocaleTimeString());
    }, 500);
  }, []);

  const debouncedSave = useDebouncedCallback(saveDraft, 1000);

  useEffect(() => {
    const subscription = form.watch((value) => {
        if(value.subject || value.body || (value.to && value.to.length > 0) || (value.cc && value.cc.length > 0)) {
            debouncedSave(value as MemoFormData);
        }
    });
    return () => subscription.unsubscribe();
  }, [form, debouncedSave]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft) {
          form.reset({
            to: draft.to || [],
            cc: draft.cc || [],
            subject: draft.subject || '',
            body: draft.body || '',
          });
          setIsDraft(true);
        }
      }
    }
  }, [form]);

  function deleteDraft() {
      if (typeof window !== 'undefined') {
          localStorage.removeItem(DRAFT_KEY);
          toast({
              title: 'Draft Deleted',
              description: 'The draft has been permanently deleted.',
          });
          form.reset({ to: [], cc: [], subject: '', body: ''});
          setIsDraft(false);
          setLastSaved(null);
          router.push('/dashboard?tab=inbox');
      }
  }

  function onSubmit(values: MemoFormData) {
    const sentMemos = JSON.parse(localStorage.getItem('memos') || '[]');
    
    const toUsers = values.to.map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[];
    const ccUsers = (values.cc || []).map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[];
    
    const creationActivity: Activity = {
        id: `act-${Date.now()}-create`,
        actor: loggedInUser,
        action: 'created',
        timestamp: new Date().toISOString(),
        details: 'Memo draft created.'
    };
    
    const sentActivity: Activity = {
        id: `act-${Date.now()}-send`,
        actor: loggedInUser,
        action: 'sent',
        timestamp: new Date().toISOString(),
        details: `Sent to ${toUsers.map(u => u.name).join(', ')}.` + (ccUsers.length > 0 ? ` CC: ${ccUsers.map(u => u.name).join(', ')}` : '')
    };

    const newMemo = {
      id: `memo-${Date.now()}`,
      memo_reference_number: `MEMO-${new Date().getFullYear()}-00${sentMemos.length + 5}`,
      from: loggedInUser,
      to: toUsers,
      cc: ccUsers,
      subject: values.subject,
      body: values.body,
      createdAt: new Date().toISOString(),
      status: 'sent' as const,
      attachments: [],
      activity: [
          creationActivity,
          sentActivity,
      ],
      current_holder: toUsers[0],
      previous_holders: []
    }
    sentMemos.push(newMemo);
    localStorage.setItem('memos', JSON.stringify(sentMemos));

    if(isDraft) {
        localStorage.removeItem(DRAFT_KEY);
    }

    toast({
      title: 'Memo Sent!',
      description: 'Your memo has been successfully sent.',
    });
    form.reset();
    router.push('/dashboard?tab=sent');
  }

  return (
    <div className="w-full">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <DraftingCompass className="h-6 w-6"/>
                    Compose New Memo
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving && <Badge variant="secondary">Saving...</Badge>}
                    {!isSaving && lastSaved && <Badge variant="outline">Saved at {lastSaved}</Badge>}
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-[80px_1fr] items-center border-b py-2">
                        <span className="font-semibold text-sm">Date - ቀን</span>
                        <div>{formatTimestamp(new Date().toISOString(), false)}</div>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] items-start border-b py-2">
                        <span className="font-semibold text-sm">From - ከ</span>
                        <div>
                            <span>{loggedInUser.name}</span>
                            <span className="text-muted-foreground text-xs block">{`${loggedInUser.division}, ${loggedInUser.department}, ${loggedInUser.office}`}</span>
                        </div>
                    </div>
                    <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-[80px_1fr] items-center space-y-0">
                            <FormLabel>To - ለ</FormLabel>
                            <FormControl>
                                <RecipientSelector
                                selected={field.value || []}
                                setSelected={(users) => field.onChange(users)}
                                placeholder="Select recipients..."
                                />
                            </FormControl>
                            <FormMessage className="col-start-2" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="cc"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-[80px_1fr] items-center space-y-0">
                            <FormLabel>CC - ግልባጭ</FormLabel>
                            <FormControl>
                                <RecipientSelector
                                selected={field.value || []}
                                setSelected={(users) => field.onChange(users)}
                                placeholder="Select CC recipients..."
                                />
                            </FormControl>
                            <FormMessage className="col-start-2" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-[80px_1fr] items-center space-y-0">
                            <FormLabel>Subject - ጉዳዩ</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter memo subject" {...field} />
                            </FormControl>
                            <FormMessage className="col-start-2" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Body</FormLabel>
                            <FormControl>
                                <Editor value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="grid grid-cols-[80px_1fr] items-center space-y-0">
                        <FormLabel>ENC - አባሪ</FormLabel>
                        <Button type="button" variant="outline" size="sm">Add Attachment</Button>
                    </div>

                    <div className="flex justify-between pt-4">
                    <div>
                        {isDraft && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Draft
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your
                                draft.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={deleteDraft}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link href="/dashboard">
                        <Button variant="outline">Cancel</Button>
                        </Link>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <Eye className="mr-2 h-4 w-4" />
                              Preview
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
                            <DialogHeader>
                              <DialogTitle>Live Preview</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto rounded-lg border bg-card text-card-foreground shadow-sm mt-4">
                                <MemoPreview memoData={previewMemo} />
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button type="submit" disabled={isSaving || !form.formState.isValid}>
                        <Send className="mr-2 h-4 w-4" />
                        Send Memo
                        </Button>
                    </div>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
