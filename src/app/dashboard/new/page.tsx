'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Send, Trash2, DraftingCompass } from 'lucide-react';
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
import type { User, Memo, Activity } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loggedInUser, users } from '@/lib/data';
import { Editor } from '@/components/editor';
import { Badge } from '@/components/ui/badge';

const memoSchema = z.object({
  id: z.string().optional(),
  to: z.array(z.any()).min(1, 'Please select at least one recipient.'),
  cc: z.array(z.any()).optional(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
});

type MemoFormData = z.infer<typeof memoSchema>;

export default function NewMemoPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
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

  const getDraftId = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('id');
    }
    return null;
  };

  const draftId = useMemo(getDraftId, []);

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
      attachments: [],
    };

    let drafts: Memo[] = JSON.parse(localStorage.getItem('memo-drafts') || '[]');
    const existingDraftIndex = drafts.findIndex(d => d.id === draft.id);

    if (existingDraftIndex > -1) {
      drafts[existingDraftIndex] = draft;
    } else {
      drafts.push(draft);
    }
    
    localStorage.setItem('memo-drafts', JSON.stringify(drafts));
    
    if (!draftId) {
      const newUrl = `/dashboard/new?id=${draft.id}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
    
    setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date().toLocaleTimeString());
    }, 500);
  }, [draftId]);

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
    if (draftId && typeof window !== 'undefined') {
      const drafts: Memo[] = JSON.parse(localStorage.getItem('memo-drafts') || '[]');
      const draft = drafts.find(d => d.id === draftId);
      if (draft) {
        form.reset({
          id: draft.id,
          to: draft.to,
          cc: draft.cc,
          subject: draft.subject,
          body: draft.body,
        });
      }
    }
  }, [draftId, form]);

  function deleteDraft() {
      if (draftId && typeof window !== 'undefined') {
          let drafts: Memo[] = JSON.parse(localStorage.getItem('memo-drafts') || '[]');
          drafts = drafts.filter(d => d.id !== draftId);
          localStorage.setItem('memo-drafts', JSON.stringify(drafts));
          toast({
              title: 'Draft Deleted',
              description: 'The draft has been permanently deleted.',
          });
          router.push('/dashboard?tab=drafts');
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

    if(draftId) {
        let drafts: Memo[] = JSON.parse(localStorage.getItem('memo-drafts') || '[]');
        drafts = drafts.filter(d => d.id !== draftId);
        localStorage.setItem('memo-drafts', JSON.stringify(drafts));
    }

    toast({
      title: 'Memo Sent!',
      description: 'Your memo has been successfully sent.',
    });
    form.reset();
    router.push('/dashboard?tab=sent');
  }

  return (
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
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <RecipientSelector
                      selected={field.value || []}
                      setSelected={(users) => field.onChange(users)}
                      placeholder="Select recipients..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CC</FormLabel>
                  <FormControl>
                    <RecipientSelector
                      selected={field.value || []}
                      setSelected={(users) => field.onChange(users)}
                      placeholder="Select CC recipients..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter memo subject" {...field} />
                  </FormControl>
                  <FormMessage />
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
            <div className="flex justify-between">
              <div>
                {draftId && (
                  <Button type="button" variant="destructive" onClick={deleteDraft}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Draft
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button variant="outline">Cancel</Button>
                </Link>
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
  );
}
