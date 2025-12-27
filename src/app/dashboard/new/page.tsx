
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { Send, Trash2, DraftingCompass, Eye, Paperclip, File as FileIcon, Loader2, BookCopy } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useDebouncedCallback } from 'use-debounce';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { RecipientSelector } from '@/components/recipient-selector';
import type { User, Memo, Attachment, MemoWithActivity } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { getLoggedInUser, getUsers, getMemo, saveDraft, sendMemo, deleteDraft } from '@/app/actions/memo';
import { formatTimestamp } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const memoTemplates = [
    {
      value: 'announcement',
      label: 'Announcement / Update Memo',
      subject: 'Announcement: [Your Title Here]',
      body: `
        <p>Dear Team,</p>
        <p><br></p>
        <p>This memo is to formally announce [briefly state the announcement or update].</p>
        <p><br></p>
        <p><strong>Key Details:</strong></p>
        <ul>
          <li><strong>What:</strong> [Detailed description of the announcement].</li>
          <li><strong>When:</strong> [Effective date or timeline].</li>
          <li><strong>Who:</strong> [Who is affected or involved].</li>
          <li><strong>Why:</strong> [Reason or benefit of this change/announcement].</li>
        </ul>
        <p><br></p>
        <p>Please take note of these changes. If you have any questions, feel free to reach out to [Contact Person/Department].</p>
        <p><br></p>
        <p>Thank you.</p>
      `,
    },
];

export default function NewMemoPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const draftId = searchParams.get('id');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [previewMemo, setPreviewMemo] = useState<MemoWithActivity | null>(null);
  
  const [to, setTo] = useState<User[]>([]);
  const [cc, setCc] = useState<User[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);

  const isReplying = !!replyTo;
  const isSendDisabled = to.length === 0 || !subject.trim() || (!isReplying && !body.trim()) || (isReplying && !replyBody.trim());

  useEffect(() => {
    async function fetchData() {
        const [user, allUsers] = await Promise.all([getLoggedInUser(), getUsers()]);
        setLoggedInUser(user);
        setUsers(allUsers);
    }
    fetchData();
  }, []);

  const availableUsers = useMemo(() => {
    if (!loggedInUser) return users;
    return users.filter(user => user.id !== loggedInUser.id);
  }, [users, loggedInUser]);
  
  const availableForTo = useMemo(() => {
    const ccIds = new Set(cc.map(u => u.id));
    return availableUsers.filter(u => !ccIds.has(u.id));
  }, [availableUsers, cc]);

  const availableForCc = useMemo(() => {
    const toIds = new Set(to.map(u => u.id));
    return availableUsers.filter(u => !toIds.has(u.id));
  }, [availableUsers, to]);

  const form = useForm();
  
  const updatePreview = useCallback(() => {
      if (!loggedInUser) return;

      const getCombinedBody = () => {
        if (replyTo && body) {
          return `${replyBody || ''}<br><br><hr>${body}`;
        }
        return replyBody || body || '';
      };
      const finalBody = getCombinedBody();
      
      const newPreview: MemoWithActivity = {
        id: 'preview',
        memo_reference_number: 'MEMO-XXXX-XXX',
        from: loggedInUser,
        to: to,
        cc: cc,
        subject: subject,
        body: finalBody,
        attachments: attachments,
        createdAt: new Date().toISOString(),
        status: 'draft',
        activity: [],
        replyToId: replyTo,
      };
      setPreviewMemo(newPreview);
  }, [loggedInUser, to, cc, subject, body, replyBody, attachments, replyTo]);
  
  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const saveDraftCallback = useCallback(async () => {
    if (!loggedInUser) return;
    
    let draftBody = replyTo ? (replyBody || '') : (body || '');
    if (replyTo && body) {
        draftBody = `${replyBody}<br><br><hr>${body}`;
    }

    const draftData = {
        to: to,
        cc: cc,
        subject: subject,
        body: draftBody,
        attachments: attachments,
        replyTo: replyTo
    };
    
    setIsSaving(true);
    const savedDraft = await saveDraft(draftData, draftId);
    
    if (savedDraft && !draftId) {
      router.replace(`/dashboard/new?id=${savedDraft.id}`, { scroll: false });
    }
    
    setIsDraft(true);
    
    setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date().toLocaleTimeString());
    }, 500);
  }, [loggedInUser, to, cc, subject, body, replyBody, attachments, draftId, replyTo, router]);

  const debouncedSave = useDebouncedCallback(saveDraftCallback, 2000);

  useEffect(() => {
    const hasContent = subject || body || replyBody || to.length || cc.length || attachments.length;
    if (hasContent) {
        debouncedSave();
    }
  }, [subject, body, replyBody, to, cc, attachments, debouncedSave]);


  useEffect(() => {
    const initialize = async () => {
      if (draftId) {
        const draft = await getMemo(draftId);
        if (draft) {
          let body = draft.body || '';
          let replyBody = '';
          if (draft.replyToId && draft.body.includes('<hr>')) {
              const parts = draft.body.split('<hr>');
              replyBody = parts[0].replace(/<br><br>$/, '');
              body = parts.slice(1).join('<hr>');
          }
          setTo(draft.to);
          setCc(draft.cc);
          setSubject(draft.subject);
          setBody(draft.replyToId ? body : draft.body);
          setReplyBody(draft.replyToId ? replyBody : '');
          setAttachments(draft.attachments);
          setReplyTo(draft.replyToId || undefined);
          setIsDraft(true);
        }
      } else {
        const replyToId = searchParams.get('replyTo');
        if (replyToId) {
            const originalMemo = await getMemo(replyToId);
            if (originalMemo) {
                const originalContent = `<p>On ${formatTimestamp(originalMemo.createdAt, false)}, ${originalMemo.from.name} wrote:</p><blockquote>${originalMemo.body}</blockquote>`;
                setBody(originalContent);
                setSubject(`Re: ${originalMemo.subject}`);
                setTo([originalMemo.from]);
                setReplyTo(replyToId);
                // Trigger a save for the new reply draft
                debouncedSave.flush();
            }
        } else {
            // Reset for a completely new memo
            setTo([]); setCc([]); setSubject(''); setBody(''); setReplyBody(''); setAttachments([]); setReplyTo(undefined);
            setIsDraft(false); setLastSaved(null);
        }
      }
    };

    initialize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, searchParams]);

  async function handleDeleteDraft() {
      if (draftId) {
          await deleteDraft(draftId);
          toast({
              title: 'Draft Deleted',
              description: 'The draft has been permanently deleted.',
          });
          router.push('/dashboard/inbox');
      }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (isSendDisabled) {
        let errorDescription = 'Please fill all required fields: To, Subject, and Body.';
        if (to.length === 0) {
          errorDescription = "Please select at least one recipient in the 'To' field.";
        } else if (!subject.trim()) {
          errorDescription = "Subject is required.";
        } else if (!isReplying && !body.trim()) {
          errorDescription = "Body is required.";
        } else if (isReplying && !replyBody.trim()) {
          errorDescription = "Your reply message is required.";
        }
        
        toast({ title: 'Cannot Send Memo', description: errorDescription, variant: 'destructive'});
        return;
    }

    setIsSending(true);

    const formData = new FormData();
    to.forEach(user => formData.append('to[]', user.id));
    cc.forEach(user => formData.append('cc[]', user.id));
    formData.append('subject', subject);
    
    let finalBody = replyTo ? `${replyBody}<br><br><hr>${body}` : body;
    formData.append('body', finalBody);
    formData.append('attachments', JSON.stringify(attachments));
    if (replyTo) formData.append('replyTo', replyTo);
    if (draftId) formData.append('draftId', draftId);
    
    const result = await sendMemo(formData);
    
    setIsSending(false);

    if (result.error) {
        toast({ title: 'Error sending memo', description: result.error, variant: 'destructive' });
    } else {
        toast({
          title: 'Memo Sent!',
          description: 'Your memo has been successfully sent.',
        });
        router.push('/dashboard/sent');
    }
  }
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filesToUpload = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} exceeds the 5MB size limit.`,
        });
        return false;
      }
      return true;
    });

    if (filesToUpload.length === 0) return;

    setIsUploading(true);

    const uploadPromises = filesToUpload.map(async file => {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const result = await response.json();
            return {
                id: `att-${Date.now()}-${result.name}`,
                name: result.name,
                size: result.size,
                type: result.type,
                url: result.path,
            };
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: `Upload failed for ${file.name}`,
                description: error.message,
            });
            return null;
        }
    });

    const newAttachments = (await Promise.all(uploadPromises)).filter(Boolean) as Attachment[];
    setAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(false);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleTemplateSelect = (templateValue: string) => {
    const template = memoTemplates.find(t => t.value === templateValue);
    if (template) {
        setSubject(template.subject);
        setBody(template.body);
    }
  };


  if (!loggedInUser) {
      return <div className="flex justify-center items-center h-full"><p>Loading user data...</p></div>;
  }

  return (
    <div className="w-full">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <DraftingCompass className="h-6 w-6"/>
                    {isReplying ? 'Compose Reply' : 'Compose New Memo'}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving && <Badge variant="secondary">Saving...</Badge>}
                    {!isSaving && lastSaved && <Badge variant="outline">Saved at {lastSaved}</Badge>}
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    {!isReplying && (
                        <div className="grid grid-cols-[120px_1fr] items-center">
                            <label className='text-right pr-4 font-semibold text-sm'>Template</label>
                            <Select onValueChange={handleTemplateSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a template (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {memoTemplates.map(template => (
                                        <SelectItem key={template.value} value={template.value}>
                                            <div className="flex items-center gap-2">
                                                <BookCopy className="h-4 w-4" />
                                                {template.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="grid grid-cols-[120px_1fr] items-center border-b py-2">
                        <span className="font-semibold text-sm text-right pr-4">Date - ቀን</span>
                        <div>{formatTimestamp(new Date().toISOString(), false)}</div>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] items-start border-b py-2">
                        <span className="font-semibold text-sm text-right pr-4">From - ከ</span>
                        <div>
                            <span>{loggedInUser.name}</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-[120px_1fr] items-center space-y-0">
                        <label className='text-right pr-4 font-semibold text-sm'>To - ለ</label>
                        <RecipientSelector
                        allUsers={availableForTo}
                        selected={to}
                        setSelected={setTo}
                        placeholder="Select recipients..."
                        />
                    </div>
                    <div className="grid grid-cols-[120px_1fr] items-center space-y-0">
                        <label className='text-right pr-4 font-semibold text-sm'>CC - ግልባጭ</label>
                        <RecipientSelector
                        allUsers={availableForCc}
                        selected={cc}
                        setSelected={setCc}
                        placeholder="Select CC recipients..."
                        />
                    </div>

                    <div className="grid grid-cols-[120px_1fr] items-center space-y-0">
                        <label className='text-right pr-4 font-semibold text-sm'>Subject - ጉዳዩ</label>
                        <Input placeholder="Enter memo subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    
                    
                    {isReplying ? (
                         <>
                         <div>
                            <label>Reply</label>
                            <Editor value={replyBody} onChange={setReplyBody} />
                         </div>
                         <div>
                            <label>Original Message</label>
                            <Editor value={body} onChange={setBody} readOnly />
                         </div>
                         </>
                    ) : (
                        <div>
                            <label>Body</label>
                            <Editor value={body} onChange={setBody} />
                        </div>
                    )}


                    <div className="grid grid-cols-[120px_1fr] items-start space-y-0">
                        <label className='text-right pr-4 pt-2 font-semibold text-sm'>ENC - አባሪ</label>
                        <div className="col-start-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                              {isUploading ? 'Uploading...' : 'Add Attachment'}
                          </Button>
                          <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            multiple
                          />
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(attachments || []).map((att) => (
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
                                <AlertDialogAction onClick={handleDeleteDraft}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link href="/dashboard/inbox">
                        <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" type="button">
                              <Eye className="mr-2 h-4 w-4" />
                              Preview
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
                            <DialogHeader>
                              <DialogTitle>Live Preview</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto rounded-lg border bg-card text-card-foreground shadow-sm mt-4">
                                <MemoDisplay memo={previewMemo} onUpdate={() => {}} isPreview />
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button type="submit" disabled={isSaving || isSendDisabled || isSending}>
                          {isSending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          {isSending ? 'Sending...' : 'Send Memo'}
                        </Button>
                    </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    </div>
  );
}

    