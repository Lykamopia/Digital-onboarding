
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { Send, Trash2, DraftingCompass, Eye, Paperclip, File as FileIcon, Loader2, BookCopy, BookPlus, MessageSquarePlus, FileCheck, ClipboardList, AlertTriangle, CalendarDays, BookMarked, Tag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useDebouncedCallback } from 'use-debounce';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RecipientSelector } from '@/components/recipient-selector';
import type { User, Memo, Attachment, MemoWithActivity, Label as LabelType } from '@/lib/types';
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
import { getLoggedInUser, getUsers, getMemo, saveDraft, sendMemo, deleteDraft, getLabels, getOrCreateActionDraft } from '@/app/actions/memo';
import { formatTimestamp } from '@/lib/data';
import { LabelSelector } from '@/components/label-selector';
import { UserProfileLoader } from '@/components/user-profile-loader';


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const memoTemplates = [
    {
      value: 'announcement',
      label: 'Announcement / Update Memo',
      icon: <BookCopy className="h-10 w-10 text-primary" />,
      subject: 'Announcement: [Your Title Here]',
      body: `<p>Dear Team,</p><p>This memo is to formally announce [briefly state the announcement or update].</p><p><strong>Key Details:</strong></p><ul><li><strong>What:</strong> [Detailed description of the announcement].</li><li><strong>When:</strong> [Effective date or timeline].</li><li><strong>Who:</strong> [Who is affected or involved].</li><li><strong>Why:</strong> [Reason or benefit of this change/announcement].</li></ul><p>Please take note of these changes. If you have any questions, feel free to reach out to [Contact Person/Department].</p><p>Thank you.</p>`,
    },
    {
      value: 'request',
      label: 'Request / Action Memo',
      icon: <MessageSquarePlus className="h-10 w-10 text-primary" />,
      subject: 'Request for [Action/Information]',
      body: `<p>This memo is to formally request [specific action or information needed].</p><p><strong>Request Details:</strong></p><ul><li><strong>Action Required:</strong> [Clearly describe the task to be performed].</li><li><strong>Deadline:</strong> [Specify the due date for the action].</li><li><strong>Background:</strong> [Provide brief context or reason for the request].</li></ul><p>Your prompt attention to this matter is greatly appreciated. Please confirm receipt and your ability to complete this request by the specified deadline.</p><p>Thank you.</p>`,
    },
    {
      value: 'confirmation',
      label: 'Confirmation Memo',
      icon: <FileCheck className="h-10 w-10 text-primary" />,
      subject: 'Confirmation of [Action/Decision]',
      body: `<p>This memo serves to confirm that [Action/Decision] has been completed/approved as of [Date].</p><p><strong>Confirmation Details:</strong></p><ul><li><strong>Subject of Confirmation:</strong> [Briefly describe what is being confirmed].</li><li><strong>Effective Date:</strong> [Date].</li><li><strong>Reference:</strong> [Any related memo reference numbers or documents].</li></ul><p>This confirmation is for your records. No further action is required at this time unless specified otherwise.</p><p>Regards,</p>`,
    },
    {
      value: 'directive',
      label: 'Directive / Instruction Memo',
      icon: <ClipboardList className="h-10 w-10 text-primary" />,
      subject: 'Directive: [Your Title Here]',
      body: `<p>This memo serves as a directive regarding [Subject of the directive].</p><p>Effective immediately, all personnel are instructed to adhere to the following procedures:</p><ol><li><strong>Instruction 1:</strong> [Clearly state the first instruction or step].</li><li><strong>Instruction 2:</strong> [Clearly state the second instruction or step].</li><li><strong>Instruction 3:</strong> [Continue as needed].</li></ol><p><strong>Reasoning:</strong> [Briefly explain the reason for this directive, e.g., compliance, efficiency, security].</p><p>Compliance with this directive is mandatory. Failure to adhere may result in [consequences, if applicable]. Please direct any questions to [Appropriate Person/Department].</p><p>Thank you for your cooperation.</p>`,
    },
    {
      value: 'incident_report',
      label: 'Problem / Incident Report Memo',
      icon: <AlertTriangle className="h-10 w-10 text-primary" />,
      subject: 'Incident Report: [Briefly Describe Incident]',
      body: `<p>This memo is to formally report an incident that occurred on [Date] at approximately [Time].</p><p><strong>Incident Summary:</strong></p><p>[Provide a brief, high-level summary of the incident.]</p><p><strong>Timeline of Events:</strong></p><ul><li><strong>[Time]:</strong> [Event 1].</li><li><strong>[Time]:</strong> [Event 2].</li><li><strong>[Time]:</strong> [Event 3].</li></ul><p><strong>Impact Assessment:</strong></p><p>[Describe the impact of the incident on operations, security, personnel, etc.]</p><p><strong>Immediate Actions Taken:</strong></p><p>[Detail any immediate steps that were taken to mitigate the incident.]</p><p>An investigation is underway to determine the root cause. Further updates will be provided as they become available.</p>`,
    },
    {
      value: 'meeting_agenda',
      label: 'Meeting / Agenda Memo',
      icon: <CalendarDays className="h-10 w-10 text-primary" />,
      subject: 'Meeting Agenda: [Meeting Title]',
      body: `<p>This memo is to announce an upcoming meeting and outline the agenda.</p><p><strong>Meeting Details:</strong></p><ul><li><strong>Date:</strong> [Date of meeting].</li><li><strong>Time:</strong> [Time of meeting].</li><li><strong>Location:</strong> [Location, e.g., Board Room, or specify if virtual].</li><li><strong>Attendees:</strong> [List key attendees or teams].</li></ul><p><strong>Agenda:</strong></p><ol><li><strong>Call to Order & Welcome</strong></li><li><strong>Review of Previous Minutes</strong></li><li><strong>[Agenda Item 1]:</strong> [Briefly describe].</li><li><strong>[Agenda Item 2]:</strong> [Briefly describe].</li><li><strong>Open Discussion / Q&A</strong></li><li><strong>Action Items & Next Steps</strong></li><li><strong>Adjournment</strong></li></ol><p>Please come prepared to discuss the items listed above. If you have anything to add to the agenda, please submit it by [Date/Time].</p>`,
    },
    {
        value: 'policy_procedure',
        label: 'Policy / Procedure Memo',
        icon: <BookMarked className="h-10 w-10 text-primary" />,
        subject: 'New Policy: [Policy Name]',
        body: `<p>This memo introduces a new policy regarding [Subject of Policy].</p><p><strong>1. Policy Statement</strong></p><p>[State the new policy clearly and concisely.]</p><p><strong>2. Purpose</strong></p><p>[Explain the reason for the new policy and the goals it aims to achieve.]</p><p><strong>3. Scope</strong></p><p>[Define who this policy applies to (e.g., all employees, specific departments).]</p><p><strong>4. Procedure</strong></p><p>[Outline the step-by-step procedures required to comply with the new policy.]</p><p><strong>5. Effective Date</strong></p><p>This policy is effective as of [Start Date].</p><p>All employees are expected to read, understand, and adhere to this new policy. Please direct any questions to [Appropriate Department or Manager].</p>`,
    },
];

export default function NewMemoPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use state for draft ID to prevent issues with stale closures in callbacks
  const [draftId, setDraftId] = useState<string | null>(searchParams.get('id'));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitializingRef = useRef(true);

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [allLabels, setAllLabels] = useState<LabelType[]>([]);
  const [previewMemo, setPreviewMemo] = useState<MemoWithActivity | null>(null);
  
  const [to, setTo] = useState<User[]>([]);
  const [cc, setCc] = useState<User[]>([]);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [forwardFrom, setForwardFrom] = useState<string | undefined>(undefined);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  const isReplying = !!replyTo;
  const isForwarding = !!forwardFrom;
  const isSendDisabled = to.length === 0 || !subject.trim() || (!isReplying && !isForwarding && !body.trim()) || ((isReplying || isForwarding) && !replyBody.trim());

  useEffect(() => {
    async function fetchData() {
        const [user, allUsers, allLabels] = await Promise.all([getLoggedInUser(), getUsers(), getLabels()]);
        setLoggedInUser(user);
        setUsers(allUsers);
        setAllLabels(allLabels);
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
        if ((replyTo || forwardFrom) && body) {
          return `${replyBody}<hr>${body}`;
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
        forwardFromId: forwardFrom,
        labels,
      };
      setPreviewMemo(newPreview);
  }, [loggedInUser, to, cc, subject, body, replyBody, attachments, replyTo, forwardFrom, labels]);
  
  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const saveDraftCallback = useCallback(async () => {
    if (!loggedInUser || isInitializingRef.current) return;
    
    let draftBody = (isReplying || isForwarding) ? replyBody : body;
    if ((isReplying || isForwarding) && body) {
        draftBody = `${replyBody}<hr>${body}`;
    }

    const draftData = {
        to: to,
        cc: cc,
        labels,
        subject: subject,
        body: draftBody,
        attachments: attachments,
        replyToId: replyTo,
        forwardFromId: forwardFrom,
    };
    
    setIsSaving(true);
    try {
        const savedDraft = await saveDraft(draftData, draftId);
        
        if (savedDraft && !draftId) {
            setDraftId(savedDraft.id); // Set the new draft ID in state
            const newParams = new URLSearchParams(window.location.search);
            newParams.set('id', savedDraft.id);
            router.replace(`${window.location.pathname}?${newParams.toString()}`, { scroll: false });
        }
        
        setIsDraft(true);
        setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
        console.error("Failed to save draft:", error);
    } finally {
        // Use a timeout to give a visual "saving" feedback
        setTimeout(() => setIsSaving(false), 500);
    }
  }, [loggedInUser, to, cc, labels, subject, body, replyBody, attachments, draftId, replyTo, forwardFrom, router, isReplying, isForwarding]);

  const debouncedSave = useDebouncedCallback(saveDraftCallback, 2000);

  useEffect(() => {
    const hasContent = subject || body || replyBody || to.length || cc.length || attachments.length || labels.length;
    if (hasContent && !isInitializingRef.current) {
        debouncedSave();
    }
  }, [subject, body, replyBody, to, cc, attachments, labels, debouncedSave]);


  useEffect(() => {
    const initialize = async () => {
        isInitializingRef.current = true;
        const currentDraftId = searchParams.get('id');
        const replyToId = searchParams.get('replyTo');
        const replyAllToId = searchParams.get('replyAllTo');
        const forwardFromId = searchParams.get('forwardFrom');

        if (currentDraftId && currentDraftId !== draftId) {
            const draft = await getMemo(currentDraftId);
            if (draft) {
                let bodyContent = draft.body || '';
                let replyContent = '';
                if ((draft.replyToId || draft.forwardFromId) && draft.body.includes('<hr>')) {
                    const parts = draft.body.split('<hr>');
                    replyContent = parts[0];
                    bodyContent = parts.slice(1).join('<hr>');
                } else if (!draft.replyToId && !draft.forwardFromId) {
                    bodyContent = draft.body;
                }
                
                setTo(draft.to);
                setCc(draft.cc);
                setLabels(draft.labels);
                setSubject(draft.subject);
                setBody(bodyContent);
                setReplyBody(replyContent);
                setAttachments(draft.attachments);
                setReplyTo(draft.replyToId || undefined);
                setForwardFrom(draft.forwardFromId || undefined);
                setIsDraft(true);
                setDraftId(currentDraftId);
            }
        } else if (replyToId || replyAllToId) {
            const originalMemoId = replyToId || replyAllToId;
            const originalMemo = await getMemo(originalMemoId!);
            if (originalMemo && loggedInUser) {
                const originalContent = `<p>On ${formatTimestamp(originalMemo.createdAt, false)}, ${originalMemo.from.name} wrote:</p><blockquote>${originalMemo.body}</blockquote>`;
                setBody(originalContent);
                const newSubject = `Re: ${originalMemo.subject}`;
                setSubject(newSubject);
                setReplyTo(originalMemoId);
                setForwardFrom(undefined);

                let toRecipients: User[], ccRecipients: User[];
                if (replyAllToId) {
                    const toSet = new Set([originalMemo.from.id]);
                    const ccSet = new Set([...originalMemo.to.map(u => u.id), ...originalMemo.cc.map(u => u.id)]);
                    ccSet.delete(loggedInUser.id);
ccSet.delete(originalMemo.from.id);
                    toRecipients = Array.from(toSet).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
                    ccRecipients = Array.from(ccSet).map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
                } else {
                    toRecipients = [originalMemo.from];
                    ccRecipients = [];
                }
                setTo(toRecipients);
                setCc(ccRecipients);

                const draft = await getOrCreateActionDraft(originalMemoId, 'reply', {
                  to: toRecipients, cc: ccRecipients, subject: newSubject, body: originalContent, replyToId: originalMemoId
                });
                if (draft) {
                  setDraftId(draft.id);
                  router.replace(`/dashboard/new?id=${draft.id}`);
                }
            }
        } else if (forwardFromId) {
            const originalMemo = await getMemo(forwardFromId);
            if (originalMemo) {
                const originalContent = `<p>---------- Forwarded message ----------</p><p>From: ${originalMemo.from.name}</p><p>Date: ${formatTimestamp(originalMemo.createdAt, false)}</p><p>Subject: ${originalMemo.subject}</p><p>To: ${originalMemo.to.map(u=>u.name).join(', ')}</p>${originalMemo.cc.length > 0 ? `<p>Cc: ${originalMemo.cc.map(u=>u.name).join(', ')}</p>`: ''}<blockquote>${originalMemo.body}</blockquote>`;
                const newSubject = `Fw: ${originalMemo.subject}`;
                setBody(originalContent);
                setSubject(newSubject);
                setReplyBody(''); // Ensure remark is clean
                setTo([]);
                setCc([]);
                setForwardFrom(forwardFromId);
                setReplyTo(undefined);
                
                const draft = await getOrCreateActionDraft(forwardFromId, 'forward', { subject: newSubject, body: originalContent, forwardFromId: forwardFromId });
                if (draft) {
                  setDraftId(draft.id);
                  router.replace(`/dashboard/new?id=${draft.id}`);
                }
            }
        } else if (!currentDraftId) {
            // Reset for a completely new memo
            setTo([]); setCc([]); setSubject(''); setBody(''); setReplyBody(''); setAttachments([]); setReplyTo(undefined); setForwardFrom(undefined); setLabels([]);
            setIsDraft(false); setLastSaved(null);
        }
        isInitializingRef.current = false;
    };

    if(loggedInUser && users.length > 0) {
        initialize();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loggedInUser, users]);

  async function handleDeleteDraft() {
      if (draftId) {
          await deleteDraft(draftId);
          toast.success('Draft Deleted', {
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
        } else if (!isReplying && !isForwarding && !body.trim()) {
          errorDescription = "Body is required.";
        } else if ((isReplying || isForwarding) && !replyBody.trim()) {
          errorDescription = "Your message/remark is required.";
        }
        
        toast.error('Cannot Send Memo', { description: errorDescription });
        return;
    }

    setIsSending(true);

    const formData = new FormData();
    to.forEach(user => formData.append('to[]', user.id));
    cc.forEach(user => formData.append('cc[]', user.id));
    labels.forEach(label => formData.append('labels[]', label.id));
    formData.append('subject', subject);
    
    let finalBody = (isReplying || isForwarding) ? `${replyBody}<hr>${body}` : body;
    formData.append('body', finalBody);
    formData.append('attachments', JSON.stringify(attachments));
    if (replyTo) formData.append('replyTo', replyTo);
    if (forwardFrom) formData.append('forwardFrom', forwardFrom);
    if (draftId) formData.append('draftId', draftId);
    
    const result = await sendMemo(formData);
    
    setIsSending(false);

    if (result.error) {
        toast.error('Error sending memo', { description: result.error });
    } else {
        toast.success('Memo Sent!', {
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
        toast.error('File too large', {
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
        formData.append('type', 'attachments');
        
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
            toast.error(`Upload failed for ${file.name}`, {
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
        setBody(template.body.trim());
    }
    setIsTemplateDialogOpen(false);
  };


  if (!loggedInUser) {
      return <div className="flex justify-center items-center h-full"><UserProfileLoader /></div>;
  }

  return (
    <div className="w-full">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <DraftingCompass className="h-6 w-6"/>
                    {isReplying ? 'Compose Reply' : isForwarding ? 'Forward Memo' : 'Compose New Memo'}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving && <Badge variant="secondary">Saving...</Badge>}
                    {!isSaving && lastSaved && <Badge variant="outline">Saved at {lastSaved}</Badge>}
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    {!isReplying && !isForwarding && (
                        <div className="flex justify-end">
                            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        <BookPlus className="mr-2 h-4 w-4" />
                                        Use a Template
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-4xl">
                                    <DialogHeader>
                                        <DialogTitle>Select a Template</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4">
                                        {memoTemplates.map(template => (
                                            <div 
                                                key={template.value}
                                                className="relative group flex flex-col items-center justify-center p-6 text-center cursor-pointer border rounded-lg bg-gradient-to-br from-muted/20 to-background backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:ring-2 hover:ring-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                onClick={() => handleTemplateSelect(template.value)}
                                                tabIndex={0}
                                                onKeyDown={(e) => e.key === 'Enter' && handleTemplateSelect(template.value)}
                                            >
                                                <div className="mb-4 transition-transform duration-300 group-hover:animate-template-icon-dance">{template.icon}</div>
                                                <p className="text-sm font-medium">{template.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
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

                     <div className="grid grid-cols-[120px_1fr] items-center space-y-0">
                        <label className='text-right pr-4 font-semibold text-sm'>Labels - መለያዎች</label>
                        <LabelSelector
                            allLabels={allLabels}
                            selected={labels}
                            setSelected={setLabels}
                            placeholder="Select labels..."
                        />
                    </div>
                    
                    
                    {isReplying || isForwarding ? (
                         <>
                         <div>
                            <label>{isReplying ? 'Reply' : 'Remark'}</label>
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
                                    <Image src={att.url.startsWith('http') ? att.url : `/api${att.url}`} alt={att.name} width={150} height={150} className="w-full h-32 object-cover" />
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
                                This action cannot be undone. This will permanently delete this draft.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteDraft} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
