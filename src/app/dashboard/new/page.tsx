
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Send, Trash2, DraftingCompass, Eye, X, File as FileIcon, Paperclip } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
import type { User, Memo, Activity, MemoWithActivity, Attachment } from '@/lib/types';
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const memoSchema = z.object({
  id: z.string().optional(),
  to: z.array(z.any()).min(1, 'Please select at least one recipient.'),
  cc: z.array(z.any()).optional(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
  attachments: z.array(z.any()).optional(),
  replyTo: z.string().optional(),
});

type MemoFormData = z.infer<typeof memoSchema>;

const DRAFT_KEY_PREFIX = 'memo-draft-';

const MemoPreview = ({ memoData }: { memoData: MemoWithActivity | null }) => {
  if (!memoData) return null;
  return <MemoDisplay memo={memoData} onUpdate={() => {}} isPreview />;
};

export default function NewMemoPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const draftId = searchParams.get('id');
  const DRAFT_KEY = draftId ? `${DRAFT_KEY_PREFIX}${draftId}` : 'memo-draft';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<MemoFormData>({
    resolver: zodResolver(memoSchema),
    defaultValues: {
      to: [],
      cc: [],
      subject: '',
      body: '',
      attachments: [],
      replyTo: undefined,
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
    attachments: currentFormData.attachments || [],
    createdAt: new Date().toISOString(),
    status: 'draft',
    activity: [],
    replyTo: currentFormData.replyTo,
  };

  const saveDraft = useCallback((data: MemoFormData) => {
    if (typeof window === 'undefined') return;
    setIsSaving(true);

    const draft: Memo = {
      id: draftId || `draft-${Date.now()}`,
      memo_reference_number: 'DRAFT',
      from: loggedInUser,
      to: data.to.map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[],
      cc: (data.cc || []).map(u => users.find(usr => usr.id === u.id)).filter(Boolean) as User[],
      subject: data.subject,
      body: data.body,
      createdAt: new Date().toISOString(),
      status: 'draft',
      attachments: data.attachments || [],
      replyTo: data.replyTo,
    };
    
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    if (!draftId) {
      router.replace(`/dashboard/new?id=${draft.id}`, { scroll: false });
    }
    
    setIsDraft(true);
    
    setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date().toLocaleTimeString());
    }, 500);
  }, [DRAFT_KEY, draftId, router]);

  const debouncedSave = useDebouncedCallback(saveDraft, 1000);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
        if (value.subject || value.body || (value.to && value.to.length > 0) || (value.cc && value.cc.length > 0) || (value.attachments && value.attachments.length > 0)) {
            debouncedSave(value as MemoFormData);
        }
    });
    return () => subscription.unsubscribe();
  }, [form, debouncedSave]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (draftId) {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft) {
          form.reset({
            to: draft.to || [],
            cc: draft.cc || [],
            subject: draft.subject || '',
            body: draft.body || '',
            attachments: draft.attachments || [],
            replyTo: draft.replyTo,
          });
          setIsDraft(true);
        }
      }
    } else {
        const replyToId = searchParams.get('replyTo');
        if (replyToId) {
            const memos: MemoWithActivity[] = JSON.parse(localStorage.getItem('memos') || '[]');
            const originalMemo = memos.find(m => m.id === replyToId);
            if (originalMemo) {
                form.reset({
                    to: [originalMemo.from],
                    cc: [],
                    subject: `Re: ${originalMemo.subject}`,
                    body: `<br><br><hr><p>On ${formatTimestamp(originalMemo.createdAt)}, ${originalMemo.from.name} wrote:</p><blockquote>${originalMemo.body}</blockquote>`,
                    attachments: [],
                    replyTo: replyToId,
                });
            }
        } else {
            localStorage.removeItem('memo-draft');
            form.reset({ to: [], cc: [], subject: '', body: '', attachments: [], replyTo: undefined });
        }
        setIsDraft(false);
        setLastSaved(null);
    }
  }, [form, draftId, DRAFT_KEY, searchParams]);


  function deleteDraft() {
      if (typeof window !== 'undefined') {
          localStorage.removeItem(DRAFT_KEY);
          toast({
              title: 'Draft Deleted',
              description: 'The draft has been permanently deleted.',
          });
          form.reset({ to: [], cc: [], subject: '', body: '', attachments: []});
          setIsDraft(false);
          setLastSaved(null);
          router.push('/dashboard?tab=inbox');
      }
  }

  function onSubmit(values: MemoFormData) {
    const sentMemos: MemoWithActivity[] = JSON.parse(localStorage.getItem('memos') || '[]');
    
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

    const newMemo: MemoWithActivity = {
      id: `memo-${Date.now()}`,
      memo_reference_number: `MEMO-${new Date().getFullYear()}-00${sentMemos.length + 5}`,
      from: loggedInUser,
      to: toUsers,
      cc: ccUsers,
      subject: values.subject,
      body: values.body,
      createdAt: new Date().toISOString(),
      status: 'sent' as const,
      attachments: values.attachments || [],
      activity: [
          creationActivity,
          sentActivity,
      ],
      current_holder: toUsers[0],
      previous_holders: [],
      replyTo: values.replyTo,
    }

    if (values.replyTo) {
      const originalMemoIndex = sentMemos.findIndex(m => m.id === values.replyTo);
      if (originalMemoIndex > -1) {
          const replyActivity: Activity = {
              id: `act-${Date.now()}-reply`,
              actor: loggedInUser,
              action: 'replied',
              timestamp: new Date().toISOString(),
              details: `Replied to this memo. See memo ${newMemo.memo_reference_number}`
          };
          sentMemos[originalMemoIndex].activity.push(replyActivity);
      }
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
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const currentAttachments = form.getValues('attachments') || [];
    const newAttachments: Attachment[] = [...currentAttachments];

    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} exceeds the 5MB size limit.`,
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newAttachment: Attachment = {
          id: `att-${Date.now()}-${file.name}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: e.target?.result as string,
        };
        newAttachments.push(newAttachment);
        form.setValue('attachments', newAttachments, { shouldValidate: true, shouldDirty: true });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    const currentAttachments = form.getValues('attachments') || [];
    const newAttachments = currentAttachments.filter(att => att.id !== id);
    form.setValue('attachments', newAttachments, { shouldValidate: true, shouldDirty: true });
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <DraftingCompass className="h-6 w-6"/>
                    {currentFormData.replyTo ? 'Compose Reply' : 'Compose New Memo'}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving && <Badge variant="secondary">Saving...</Badge>}
                    {!isSaving && lastSaved && <Badge variant="outline">Saved at {lastSaved}</Badge>}
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-[120px_1fr] items-center border-b py-2">
                        <span className="font-semibold text-sm text-right pr-4">Date - ቀን</span>
                        <div>{formatTimestamp(new Date().toISOString(), false)}</div>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] items-start border-b py-2">
                        <span className="font-semibold text-sm text-right pr-4">From - ከ</span>
                        <div>
                            <span>{loggedInUser.name}</span>
                            <span className="text-muted-foreground text-xs block">{`${loggedInUser.division}, ${loggedInUser.department}, ${loggedInUser.office}`}</span>
                        </div>
                    </div>
                    <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-[120px_1fr] items-center space-y-0">
                            <FormLabel className='text-right pr-4'>To - ለ</FormLabel>
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
                        <FormItem className="grid grid-cols-[120px_1fr] items-center space-y-0">
                            <FormLabel className='text-right pr-4'>CC - ግልባጭ</FormLabel>
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
                        <FormItem className="grid grid-cols-[120px_1fr] items-center space-y-0">
                            <FormLabel className='text-right pr-4'>Subject - ጉዳዩ</FormLabel>
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
                    <div className="grid grid-cols-[120px_1fr] items-start space-y-0">
                        <FormLabel className='text-right pr-4 pt-2'>ENC - አባሪ</FormLabel>
                        <div className="col-start-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                              <Paperclip className="mr-2 h-4 w-4" />
                              Add Attachment
                          </Button>
                          <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            multiple
                          />
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(currentFormData.attachments || []).map((att) => (
                              <div key={att.id} className="relative group border rounded-lg overflow-hidden">
                                {att.type.startsWith('image/') ? (
                                    <Image src={att.url} alt={att.name} width={150} height={150} className="w-full h-32 object-cover" />
                                ) : (
                                    <div className="w-full h-32 bg-muted flex flex-col items-center justify-center p-2">
                                        <FileIcon className="h-10 w-10 text-muted-foreground" />
                                        <p className="text-xs text-center mt-2 text-muted-foreground break-all">{att.name}</p>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 flex flex-col justify-between p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div>
                                        <p className="text-xs font-bold break-all">{att.name}</p>
                                        <p className="text-xs">{formatFileSize(att.size)}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className='w-full h-8 text-xs'
                                      onClick={() => removeAttachment(att.id)}
                                    >
                                      <Trash2 className="mr-2 h-3 w-3" />
                                      Remove
                                    </Button>
                                </div>

                              </div>
                            ))}
                          </div>
                        </div>
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
