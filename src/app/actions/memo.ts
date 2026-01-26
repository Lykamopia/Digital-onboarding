
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { Memo, User, Label, AcknowledgementType, Permission, Role, Office, Prisma, DelegationPermission, LoggedInUser } from '@/lib/types';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { sendEmail, sendWelcomeEmail, sendPasswordResetEmail } from '@/lib/email';
import WebSocket from 'ws';
import { redirect } from 'next/navigation';
import { passwordSchema, generateStrongPassword } from '@/lib/password-policy';
import Papa from 'papaparse';

async function hasPermission(permission: Permission | Permission[]): Promise<LoggedInUser> {
    const user = await getLoggedInUser();
    if (!user) {
        throw new Error("Not authenticated");
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    // For delegated sessions, all permission checks happen inside the actions themselves.
    // The `hasPermission` function is for standard role-based access control.
    if (user.actingUser) {
        // This function is for RBAC, delegation checks are done in the actions.
        // We return the user object to allow the action to proceed to its specific delegation check.
        return user;
    }

    const userPermissions = user.role?.permissions ? user.role.permissions.split(',') : [];
    
    const hasRequiredPermission = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasRequiredPermission) {
        throw new Error("Access Denied: You do not have the required permissions.");
    }
    
    return user;
}


const memoSchema = z.object({
  to: z.array(z.string()).min(1, 'Please select at least one recipient.'),
  cc: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
  attachments: z.array(z.any()).optional(),
  replyTo: z.string().optional(),
  assignFrom: z.string().optional(),
  scheduledFor: z.date().optional(),
});

// Function to send data to WebSocket server via HTTP
async function sendToWebSocket(data: any) {
    try {
        const payload = {
            ...data,
            recipientIds: [...new Set([...data.payload.to.map((u: User) => u.id), ...data.payload.cc.map((u: User) => u.id)])],
        }

        await fetch(`http://localhost:${process.env.WEBSOCKET_PORT || 3011}/broadcast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error('Failed to send message to WebSocket server:', error);
    }
}

export async function getDashboardData(tab: string, query: string, category: string, dateRange: { from?: string, to?: string}, labels: string[] = [], show: string) {
    const user = await getLoggedInUser();
    if (!user) {
        return [];
    }

    if (user.mustChangePassword) {
      return [];
    }
    
    const userId = user.id;

    const where: any = {
        AND: []
    };

    const isArchivedByCurrentUser = { archivedBy: { some: { id: userId } } };

    if (tab === 'archive') {
        where.AND.push(isArchivedByCurrentUser);
    } else {
        where.AND.push({ NOT: isArchivedByCurrentUser });
        if (tab === 'inbox') {
            where.AND.push({
                status: { in: ['sent', 'scheduled'] } ,
                OR: [
                    { to: { some: { id: userId } } },
                    { cc: { some: { id: userId } } },
                    { current_holderId: userId },
                ],
            });
            if (category === 'direct') {
                where.AND.push({
                    OR: [
                        { to: { some: { id: userId } } },
                        { current_holderId: userId },
                    ]
                });
            } else if (category === 'cc') {
                where.AND.push({
                    cc: { some: { id: userId } },
                    NOT: {
                        OR: [
                            { to: { some: { id: userId } } },
                            { current_holderId: userId },
                        ]
                    }
                });
            }
        } else if (tab === 'sent') {
            where.AND.push({ fromId: userId, status: { not: 'draft' } });
            if (category === 'sent') {
                where.AND.push({ replyToId: null, assignedFromId: null });
            } else if (category === 'replied') {
                where.AND.push({ replyToId: { not: null } });
            } else if (category === 'assigned') {
                where.AND.push({ assignedFromId: { not: null } });
            }
        } else if (tab === 'drafts') {
            where.AND.push({ fromId: userId, status: 'draft' });
        } else if (tab === 'scheduled') {
             where.AND.push({ fromId: userId, status: 'scheduled' });
        } else if (tab === 'favorites') {
            where.AND.push({ favoritedBy: { some: { id: userId } } });
        }
    }
    
    if (query) {
        where.AND.push({
             OR: [
                { subject: { contains: query } },
                { body: { contains: query } },
                { memo_reference_number: { contains: query } },
                { from: { name: { contains: query } } },
                { to: { some: { name: { contains: query } } } },
            ]
        })
    }
    
    if (labels.length > 0) {
        where.AND.push({
            labels: { some: { id: { in: labels } } }
        });
    }

    if (dateRange?.from) {
        where.AND.push({ createdAt: { gte: new Date(dateRange.from) } });
    }
    if (dateRange?.to) {
        where.AND.push({ createdAt: { lte: new Date(dateRange.to) } });
    }
    
    if (show === 'favorites' && tab !== 'favorites') {
        where.AND.push({ favoritedBy: { some: { id: userId } } });
    } else if (show === 'flagged') {
        where.AND.push({ flaggedBy: { some: { id: userId } } });
    }
    
    if(user.actingUser && !user.delegationPermissions?.includes('delegation:view')) {
      return []; // If no view permission, return nothing.
    }

    const memos = await prisma.memo.findMany({
        where,
        include: {
            from: { include: { role: true } },
            to: { include: { role: true } },
            cc: { include: { role: true } },
            labels: true,
            attachments: true,
            activity: {
                include: {
                    actor: true
                }
            },
            current_holder: { include: { role: true } },
            previous_holders: { include: { role: true } },
            acknowledgedBy: { include: { role: true } },
            archivedBy: { include: { role: true } },
            favoritedBy: { where: { id: userId }, select: { id: true } },
            flaggedBy: { where: { id: userId }, select: { id: true } },
        },
        orderBy: [
            { favoritedBy: { _count: 'desc' } }, // favorited memos first
            { createdAt: 'desc' }
        ]
    });
    return memos;
}

export async function getAuditMemos() {
    await hasPermission('manage_audit_log');
    return await prisma.memo.findMany({
        where: {
            status: { not: 'draft' }
        },
        include: {
            from: { include: { role: true } },
            to: { include: { role: true } },
            cc: { include: { role: true } },
            labels: true,
            attachments: true,
            activity: {
                include: {
                    actor: true
                },
                orderBy: { timestamp: 'asc' }
            },
            current_holder: { include: { role: true } },
            previous_holders: { include: { role: true } },
            acknowledgedBy: { include: { role: true } },
            replies: {
                include: {
                  from: {
                    include: {
                      role: true,
                    },
                  },
                },
              },
            replyTo: { include: { from: { include: { role: true } } } },
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}

export async function toggleFavorite(memoId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const userId = user.id;

    const memo = await prisma.memo.findUnique({
        where: { id: memoId },
        include: { favoritedBy: { where: { id: userId } } }
    });

    if (!memo) throw new Error("Memo not found");

    const isFavorited = memo.favoritedBy.length > 0;

    await prisma.memo.update({
        where: { id: memoId },
        data: {
            favoritedBy: isFavorited
                ? { disconnect: { id: userId } }
                : { connect: { id: userId } }
        }
    });

    revalidatePath('/dashboard/inbox');
    revalidatePath('/dashboard/sent');
    revalidatePath('/dashboard/drafts');
    revalidatePath('/dashboard/archive');
    revalidatePath('/dashboard/favorites');
    return { success: true, isFavorited: !isFavorited };
}

export async function toggleFlag(memoId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");
    
    const userId = user.id;

    const memo = await prisma.memo.findUnique({
        where: { id: memoId },
        include: { flaggedBy: { where: { id: userId } } }
    });

    if (!memo) throw new Error("Memo not found");

    const isFlagged = memo.flaggedBy.length > 0;

    await prisma.memo.update({
        where: { id: memoId },
        data: {
            flaggedBy: isFlagged
                ? { disconnect: { id: userId } }
                : { connect: { id: userId } }
        }
    });

    revalidatePath('/dashboard/inbox');
    revalidatePath('/dashboard/sent');
    revalidatePath('/dashboard/drafts');
    revalidatePath('/dashboard/archive');
    return { success: true, isFlagged: !isFlagged };
}

export async function getMemo(id: string) {
  if (!id) return null;
  const user = await getLoggedInUser();
  const userId = user?.id;

  const memo = await prisma.memo.findUnique({
    where: { id },
    include: {
      from: { include: { role: true } },
      to: { include: { role: true } },
      cc: { include: { role: true } },
      labels: true,
      attachments: true,
      activity: { include: { actor: true }, orderBy: { timestamp: 'desc' } },
      current_holder: { include: { role: true } },
      previous_holders: { include: { role: true } },
      acknowledgedBy: { include: { role: true } },
      archivedBy: { include: { role: true } },
      replies: {
        include: {
          from: {
            include: {
              role: true,
            },
          },
        },
      },
      replyTo: { include: { from: { include: { role: true } } } },
      favoritedBy: { where: { id: userId }, select: { id: true } },
      flaggedBy: { where: { id: userId }, select: { id: true } },
    },
  });
  return memo;
}


export async function markAsRead(memoId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const actorId = user.actingUser ? user.actingUser.id : user.id;

    const memo = await prisma.memo.findUnique({
        where: { id: memoId },
        include: {
            activity: {
                where: { actorId: actorId, action: { in: ['viewed', 'acknowledged'] } }
            },
            to: { select: { id: true } },
            cc: { select: { id: true } },
            current_holder: { select: { id: true } },
        }
    });

    if (!memo) return;

    if (!memo.activity.some(a => a.action === 'viewed')) {
        await prisma.activity.create({
            data: {
                memoId: memoId,
                actorId: actorId,
                action: 'viewed',
            }
        });

        const { acknowledgementMode } = await getGeneralSettings();
        const hasAcknowledged = memo.activity.some(a => a.action === 'acknowledged');

        if (acknowledgementMode === 'auto' && !hasAcknowledged) {
            const isDirectRecipient = memo.to.some(u => u.id === user.id) || memo.current_holder?.id === user.id;
            const isCcRecipient = memo.cc.some(u => u.id === user.id);
            
            if (isDirectRecipient || isCcRecipient) {
                await acknowledgeMemo(memoId);
            }
        }

        revalidatePath('/dashboard/inbox');
        revalidatePath(`/dashboard?id=${memoId}`);
    }
}


export async function markAllAsReadForUser() {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const actorId = user.actingUser ? user.actingUser.id : user.id;

    const unreadMemos = await prisma.memo.findMany({
        where: {
            AND: [
                {
                    status: { not: 'draft' },
                    OR: [
                        { to: { some: { id: user.id } } },
                        { cc: { some: { id: user.id } } },
                        { current_holderId: user.id },
                    ],
                },
                { NOT: { archivedBy: { some: { id: user.id } } } },
                {
                    NOT: {
                        activity: {
                            some: {
                                actorId: actorId,
                                action: { in: ['viewed', 'acknowledged'] }
                            }
                        }
                    }
                }
            ]
        },
        select: {
            id: true
        }
    });

    if (unreadMemos.length === 0) {
        return { success: true, count: 0 };
    }

    await prisma.activity.createMany({
        data: unreadMemos.map(memo => ({
            memoId: memo.id,
            actorId: actorId,
            action: 'viewed',
            details: 'Marked as read via "Mark all as read"'
        }))
    });

    revalidatePath('/dashboard/inbox');
    return { success: true, count: unreadMemos.length };
}


export async function toggleMemoReadStatus(memoId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const actorId = user.actingUser ? user.actingUser.id : user.id;

    const memo = await prisma.memo.findUnique({
        where: { id: memoId },
        include: { activity: { where: { actorId: actorId, action: 'viewed' } } }
    });

    if (!memo) throw new Error("Memo not found");

    if (memo.activity.length === 0) {
        await prisma.memo.update({
            where: { id: memoId },
            data: {
                activity: {
                    create: {
                        actorId: actorId,
                        action: 'viewed',
                    }
                }
            }
        });
    }
    revalidatePath('/dashboard/inbox');
    revalidatePath(`/dashboard?id=${memoId}`);
    return getDashboardData('inbox', '', 'all', {}, [], 'all');
}


async function generateReferenceNumber(user: User): Promise<string> {
    const settings = await getGeneralSettings();
    const format = settings.referenceFormat;
    
    const userWithRelations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            office: true,
            department: true,
        }
    });
    
    if (!userWithRelations) throw new Error("User not found for reference generation.");

    let prefixPart = '';
    if (format.prefix === 'department' && userWithRelations.department) {
        prefixPart = userWithRelations.department.code;
    } else if (format.prefix === 'office' && userWithRelations.office) {
        prefixPart = userWithRelations.office.code;
    }

    const year = new Date().getFullYear();
    const fullPrefix = `${prefixPart}${format.separator}${year}${format.separator}`;

    const lastMemo = await prisma.memo.findFirst({
        where: {
            memo_reference_number: {
                startsWith: fullPrefix
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        select: {
            memo_reference_number: true
        }
    });

    let nextSequence = 1;
    if (lastMemo?.memo_reference_number) {
        const lastNumberStr = lastMemo.memo_reference_number.split(format.separator).pop();
        const lastNumber = parseInt(lastNumberStr || '0', 10);
        if (!isNaN(lastNumber)) {
            nextSequence = lastNumber + 1;
        }
    }

    const sequenceString = String(nextSequence).padStart(format.numberLength, '0');

    return `${fullPrefix}${sequenceString}`;
}


export async function sendMemo(formData: FormData): Promise<{ success: boolean; error?: string; memo?: Memo; }> {
    const user = await getLoggedInUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const to = formData.getAll('to[]') as string[];
    const cc = formData.getAll('cc[]') as string[];
    const labels = formData.getAll('labels[]') as string[];
    const scheduledForRaw = formData.get('scheduledFor') as string | null;
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : undefined;

    const data = {
        to, cc, labels, scheduledFor,
        subject: formData.get('subject') as string,
        body: formData.get('body') as string,
        attachments: JSON.parse(formData.get('attachments') as string || '[]'),
        replyTo: formData.get('replyTo') as string || undefined,
        assignFrom: formData.get('assignFrom') as string || undefined,
    };
    
    const validation = memoSchema.safeParse(data);
    if (!validation.success) {
        console.error(validation.error.flatten().fieldErrors);
        return { success: false, error: 'Invalid memo data', details: validation.error.flatten().fieldErrors };
    }
    
    const validatedData = validation.data;
    const actorId = user.actingUser ? user.actingUser.id : user.id;

    const isReplyingOrAssigning = validatedData.replyTo || validatedData.assignFrom;
    if (user.actingUser) {
        const requiredPermission = isReplyingOrAssigning ? 'delegation:reply' : 'delegation:send';
        if (!user.delegationPermissions?.includes(requiredPermission)) {
            const action = isReplyingOrAssigning ? 'reply to or assign' : 'send';
            return { success: false, error: `Access Denied: You do not have permission to ${action} memos.` };
        }
    } else {
        await hasPermission('manage_memos');
    }

    const isScheduled = validatedData.scheduledFor && validatedData.scheduledFor > new Date();
    const newReferenceNumber = await generateReferenceNumber(user);
    
    const newMemoData: any = {
        memo_reference_number: newReferenceNumber,
        fromId: user.id,
        to: { connect: validatedData.to.map(id => ({ id })) },
        cc: { connect: validatedData.cc?.map(id => ({ id })) },
        labels: { connect: validatedData.labels?.map(id => ({ id })) },
        current_holderId: validatedData.to[0],
        subject: validatedData.subject,
        body: validatedData.body,
        status: isScheduled ? 'scheduled' : 'sent',
        attachments: { create: validatedData.attachments.map((att: any) => ({ name: att.name, type: att.type, size: att.size, url: att.url })) },
        activity: { create: [{ actorId: actorId, action: isScheduled ? 'scheduled' : 'sent', details: isScheduled ? `Scheduled on ${validatedData.scheduledFor?.toLocaleString()}` : `Sent to recipients.` }] },
        replyToId: validatedData.replyTo,
        assignedFromId: validatedData.assignFrom,
        scheduledFor: validatedData.scheduledFor,
    };

    const newMemo = await prisma.memo.create({
        data: newMemoData,
        include: {
            from: { include: { role: true } },
            to: { include: { role: true } },
            cc: { include: { role: true } },
            attachments: true, labels: true,
            activity: { include: { actor: true } },
            current_holder: { include: { role: true } },
            previous_holders: { include: { role: true } },
            acknowledgedBy: { include: { role: true } },
            archivedBy: { include: { role: true } },
            favoritedBy: { where: { id: user.id }, select: { id: true } },
            flaggedBy: { where: { id: user.id }, select: { id: true } },
        }
    });
    
    if (validatedData.assignFrom) {
        const recipients = validatedData.to.map(id => newMemo.to.find(u => u.id === id)?.name || 'Unknown').join(', ');
        await prisma.memo.update({
            where: { id: validatedData.assignFrom },
            data: {
                acknowledgedBy: { connect: { id: user.id } },
                activity: {
                    create: [
                        { actorId: actorId, action: 'assigned', details: `Assigned to ${recipients}.\n<b>Remark:</b> ${newMemo.body.split('<hr>')[0]}` },
                        { actorId: actorId, action: 'acknowledged', details: 'Acknowledged receipt of the memo by assigning it.' }
                    ]
                }
            }
        });
    }

    if (validatedData.replyTo) {
        await prisma.memo.update({
            where: { id: validatedData.replyTo },
            data: {
                activity: { create: { actorId: actorId, action: 'replied', details: `Replied to this memo. See memo ${newMemo.memo_reference_number}` } }
            }
        });
    }

    const draftId = formData.get('draftId') as string;
    if (draftId) await prisma.memo.delete({ where: { id: draftId } });
    
    if (isScheduled) {
        revalidatePath('/dashboard/scheduled');
        return { success: true, memo: newMemo };
    }

    await sendToWebSocket({ type: 'new-memo', payload: newMemo });
    
    const allRecipients = [...newMemo.to, ...newMemo.cc];
    for (const recipient of allRecipients) {
        try {
            await sendEmail({
                to: recipient.email,
                subject: `New Memo: ${newMemo.subject}`,
                memo: newMemo,
                sender: user,
                type: newMemo.to.some(u => u.id === recipient.id) ? 'direct' : 'cc'
            });
        } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
        }
    }

    revalidatePath('/dashboard/inbox');
    return { success: true, memo: newMemo };
}

export async function saveDraft(data: Partial<Memo> & { to?: User[], cc?: User[], labels?: Label[] }, draftId?: string | null): Promise<{ success: boolean; error?: string; draft?: Memo; }> {
    const user = await getLoggedInUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const isReplyingOrAssigning = data.replyToId || data.assignedFromId;
    if (user.actingUser) {
        const requiredPermission = isReplyingOrAssigning ? 'delegation:reply' : 'delegation:draft';
        if (!user.delegationPermissions?.includes(requiredPermission)) {
            const action = isReplyingOrAssigning ? 'draft replies or assignments' : 'create drafts';
            return { success: false, error: `Access Denied: You do not have permission to ${action}.` };
        }
    } else {
        await hasPermission('manage_memos');
    }

    const fromId = user.id;
    const attachmentsData = { create: (data.attachments || []).map((att: any) => ({ name: att.name, type: att.type, size: att.size, url: att.url })) };

    if (draftId) {
         const existingDraft = await prisma.memo.findUnique({ where: { id: draftId }, include: { to: true, cc: true, labels: true }});
        const toIds = (data.to || []).map(u => u.id);
        const ccIds = (data.cc || []).map(u => u.id);
        const labelIds = (data.labels || []).map(l => l.id);
        const toToDisconnect = existingDraft?.to.filter(u => !toIds.includes(u.id)) || [];
        const ccToDisconnect = existingDraft?.cc.filter(u => !ccIds.includes(u.id)) || [];
        const labelsToDisconnect = existingDraft?.labels.filter(l => !labelIds.includes(l.id)) || [];
        
        const payload: any = {
            fromId, subject: data.subject || '', body: data.body || '',
            to: { disconnect: toToDisconnect.map(u => ({ id: u.id })), connect: toIds.map(id => ({ id })) },
            cc: { disconnect: ccToDisconnect.map(u => ({ id: u.id })), connect: ccIds.map(id => ({ id })) },
            labels: { disconnect: labelsToDisconnect.map(l => ({ id: l.id })), connect: labelIds.map(id => ({ id })) },
            attachments: { deleteMany: {}, ...attachmentsData },
            status: 'draft' as const,
            replyToId: data.replyToId, assignedFromId: data.assignedFromId,
        };
        const updatedDraft = await prisma.memo.update({ where: { id: draftId }, data: payload });
        return { success: true, draft: updatedDraft };
    } else {
        const payload: any = {
            fromId, subject: data.subject || '', body: data.body || '',
            to: { connect: (data.to || []).map(u => ({ id: u.id })) },
            cc: { connect: (data.cc || []).map(u => ({ id: u.id })) },
            labels: { connect: (data.labels || []).map(l => ({ id: l.id })) },
            attachments: attachmentsData,
            status: 'draft' as const, memo_reference_number: `DRAFT-${Date.now()}`,
            replyToId: data.replyToId, assignedFromId: data.assignedFromId,
        };
        const newDraft = await prisma.memo.create({ data: payload });
        return { success: true, draft: newDraft };
    }
}

export async function getOrCreateActionDraft(originalMemoId: string, action: 'reply' | 'assign', initialData: Partial<Memo> & { to?: User[], cc?: User[], labels?: Label[] } = {}) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const whereClause: any = { fromId: user.id, status: 'draft' };
    if (action === 'reply') whereClause.replyToId = originalMemoId;
    if (action === 'assign') whereClause.assignedFromId = originalMemoId;

    const existingDrafts = await prisma.memo.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, include: { to: true, cc: true, labels: true, attachments: true }});
    if (existingDrafts.length > 0) {
        if (existingDrafts.length > 1) {
            await prisma.memo.deleteMany({ where: { id: { in: existingDrafts.slice(1).map(d => d.id) } } });
        }
        return existingDrafts[0];
    }

    const payload: any = {
        fromId: user.id, subject: initialData.subject || '', body: initialData.body || '',
        to: { connect: (initialData.to || []).map((u: any) => ({ id: u.id })) },
        cc: { connect: (initialData.cc || []).map((u: any) => ({ id: u.id })) },
        labels: { connect: (initialData.labels || []).map((l: any) => ({ id: l.id })) },
        attachments: { create: (initialData.attachments || []).map((att: any) => ({ name: att.name, type: att.type, size: att.size, url: att.url })) },
        status: 'draft' as const, memo_reference_number: `DRAFT-${Date.now()}`,
    };
    if (action === 'reply') payload.replyToId = originalMemoId;
    if (action === 'assign') payload.assignedFromId = originalMemoId;

    const newDraft = await prisma.memo.create({ data: payload, include: { to: true, cc: true, labels: true, attachments: true } });
    return newDraft;
}


export async function deleteDraft(draftId: string) {
    await hasPermission('manage_memos');
    await prisma.memo.delete({ where: { id: draftId }});
    revalidatePath('/dashboard/drafts');
    return { success: true };
}

export async function duplicateMemo(memoId: string) {
    await hasPermission('manage_memos');

    const originalMemo = await prisma.memo.findUnique({ where: { id: memoId }, include: { to: true, cc: true, attachments: true, labels: true }});
    if (!originalMemo) throw new Error("Memo not found");

    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const newDraft = await prisma.memo.create({
        data: {
            fromId: user.id,
            subject: `(copy) ${originalMemo.subject}`, body: originalMemo.body, status: 'draft', memo_reference_number: `DRAFT-${Date.now()}`,
            to: { connect: originalMemo.to.map(u => ({ id: u.id })) },
            cc: { connect: originalMemo.cc.map(u => ({ id: u.id })) },
            labels: { connect: originalMemo.labels.map(l => ({ id: l.id })) },
            attachments: { create: originalMemo.attachments.map(att => ({ name: att.name, size: att.size, type: att.type, url: att.url })) }
        }
    });
    redirect(`/dashboard/new?id=${newDraft.id}`);
}


export async function acknowledgeMemo(memoId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: "Not authenticated" };
  
  if (user.actingUser) {
    if (!user.delegationPermissions?.includes('delegation:acknowledge')) {
      return { success: false, error: "Access Denied: You do not have permission to acknowledge memos on behalf of this user." };
    }
  }

  const memo = await getMemo(memoId);
  if (!memo) return { success: false, error: "Memo not found." };
  
  const isDirectRecipient = memo.to.some(u => u.id === user.id) || memo.current_holder?.id === user.id;
  const isCcRecipient = memo.cc.some(u => u.id === user.id);

  if (!isDirectRecipient && !isCcRecipient) {
    return { success: false, error: "You are not a recipient of this memo and cannot acknowledge it." };
  }
  
  const actorId = user.actingUser ? user.actingUser.id : user.id;

  const updateData: any = {
    acknowledgedBy: { connect: { id: user.id } },
    activity: { create: { actorId: actorId, action: 'acknowledged', details: 'Acknowledged receipt of the memo.' } },
  };
  
  if (isDirectRecipient) {
      updateData.current_holder = { connect: { id: user.id } };
  }

  await prisma.memo.update({ where: { id: memoId }, data: updateData });

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard?id=${memoId}`);
  return { success: true };
}

export async function archiveMemo(memoId: string, archive: boolean) {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Not authenticated");

  const actorId = user.actingUser ? user.actingUser.id : user.id;

  const data = archive ? 
    { archivedBy: { connect: { id: user.id } } } :
    { archivedBy: { disconnect: { id: user.id } } };
    
  await prisma.memo.update({
      where: { id: memoId },
      data: {
          ...data,
          activity: { create: { actorId: actorId, action: archive ? 'archived' : 'unarchived', details: archive ? 'Archived the memo.' : 'Unarchived the memo.' } }
      }
  });

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard?id=${memoId}`);
}


export async function getUsers() {
    return await prisma.user.findMany({
        include: {
            role: true,
            office: true,
            department: true,
            division: true,
            district: true,
            branch: true,
        },
        orderBy: {
            name: 'asc'
        }
    });
}

export async function getAllMemosForAdmin() {
    await hasPermission('manage_archive');
    return await prisma.memo.findMany({
        include: {
            from: true,
            to: true,
            cc: true,
            archivedBy: true,
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}


export async function getDivisions() {
    return await prisma.division.findMany({ include: { department: true }});
}
export async function getDepartments() {
    return await prisma.department.findMany({ include: { office: true }});
}
export async function getBranches() {
    return await prisma.branch.findMany({ include: { district: true }});
}
export async function getDistricts() {
    return await prisma.district.findMany({ include: { office: true }});
}
export async function getOffices() {
    return await prisma.office.findMany({ include: { departments: true, districts: true } });
}
export async function getRoles() {
    return await prisma.role.findMany();
}
export async function getLabels() {
    return await prisma.label.findMany();
}

export async function getLoggedInUser(): Promise<LoggedInUser | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return null;
    }
    const sessionUser = session.user as any;
    const userId = sessionUser.isDelegated ? sessionUser.id : sessionUser.id;

    if (!userId) return null;
    
    const userInclude = {
        role: true,
        office: true,
        department: true,
        division: true,
        district: true,
        branch: true,
        delegations: { include: { delegate: true } },
        delegatedTo: { include: { delegator: true } }
    };
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: userInclude
    });

    if (!user) return null;
    
    if (user.status === 'inactive' && !user.mustChangePassword) {
        return null;
    }

    if (sessionUser.isDelegated) {
        return {
            ...user,
            actingUser: sessionUser.realUser,
            delegationPermissions: sessionUser.delegationPermissions,
        };
    }

    return user;
}


export async function getUserLockoutStatus(email: string) {
    if (!email) return null;
    const user = await prisma.user.findUnique({
        where: { email },
        select: { lockoutUntil: true }
    });
    return user;
}


// Admin actions
export async function saveDivision(data: { id?: string, name: string, code: string, departmentId: string }) {
    await hasPermission('manage_divisions');
    if (data.id) {
        await prisma.division.update({ where: { id: data.id }, data });
    } else {
        await prisma.division.create({ data });
    }
    revalidatePath('/dashboard/admin/divisions');
}

export async function deleteDivision(id: string) {
    await hasPermission('manage_divisions');
    const users = await prisma.user.count({ where: { divisionId: id }});
    if (users > 0) {
        return { error: 'Cannot delete division. It has associated users. Please reassign them first.' };
    }

    await prisma.division.delete({ where: { id } });
    revalidatePath('/dashboard/admin/divisions');
    return { success: true };
}


export async function saveDepartment(data: { id?: string, name: string, code: string, officeId: string }) {
    await hasPermission('manage_departments');
    if (data.id) {
        await prisma.department.update({ where: { id: data.id }, data });
    } else {
        await prisma.department.create({ data });
    }
    revalidatePath('/dashboard/admin/departments');
}

export async function deleteDepartment(id: string) {
    await hasPermission('manage_departments');
    const divisions = await prisma.division.count({ where: { departmentId: id } });
    if (divisions > 0) {
        return { error: 'Cannot delete department. It has associated divisions. Please delete them first.' };
    }
    await prisma.department.delete({ where: { id } });
    revalidatePath('/dashboard/admin/departments');
    return { success: true };
}

export async function saveBranch(data: { id?: string, name: string, code: string, districtId: string }) {
    await hasPermission('manage_branches');
    if (data.id) {
        await prisma.branch.update({ where: { id: data.id }, data });
    } else {
        await prisma.branch.create({ data });
    }
    revalidatePath('/dashboard/admin/branches');
}

export async function deleteBranch(id: string) {
    await hasPermission('manage_branches');
    const users = await prisma.user.count({ where: { branchId: id }});
    if (users > 0) {
        return { error: 'Cannot delete branch. It has associated users. Please reassign them first.' };
    }
    await prisma.branch.delete({ where: { id } });
    revalidatePath('/dashboard/admin/branches');
    return { success: true };
}

export async function saveDistrict(data: { id?: string, name: string, code: string, officeId: string }) {
    await hasPermission('manage_districts');
    if (data.id) {
        await prisma.district.update({ where: { id: data.id }, data });
    } else {
        await prisma.district.create({ data });
    }
    revalidatePath('/dashboard/admin/districts');
}

export async function deleteDistrict(id: string) {
    await hasPermission('manage_districts');
    const branches = await prisma.branch.count({ where: { districtId: id } });
    if (branches > 0) {
        return { error: 'Cannot delete district. It has associated branches. Please delete them first.' };
    }
    await prisma.district.delete({ where: { id } });
    revalidatePath('/dashboard/admin/districts');
    return { success: true };
}

export async function saveOffice(data: { id?: string, name: string, code: string, type?: 'division_office' | 'branch_office' | 'head_office' }) {
    await hasPermission('manage_offices');
    const payload = {
        name: data.name,
        code: data.code,
        type: data.type || 'branch_office'
    };
    if (data.id) {
        await prisma.office.update({ where: { id: data.id }, data: payload });
    } else {
        await prisma.office.create({ data: payload });
    }
    revalidatePath('/dashboard/admin/offices');
}

export async function deleteOffice(id: string) {
    await hasPermission('manage_offices');
    const districts = await prisma.district.count({ where: { officeId: id } });
    if (districts > 0) {
        return { error: 'Cannot delete office. It has associated districts. Please delete them first.' };
    }
    
    const departments = await prisma.department.count({ where: { officeId: id } });
    if (departments > 0) {
        return { error: 'Cannot delete office. It has associated departments. Please delete them first.' };
    }
    
    const users = await prisma.user.count({ where: { officeId: id }});
    if (users > 0) {
        return { error: 'Cannot delete office. It has associated users. Please reassign them first.' };
    }

    await prisma.office.delete({ where: { id } });
    revalidatePath('/dashboard/admin/offices');
    return { success: true };
}


export async function saveUser(data: { 
    id?: string, 
    name: string, 
    email: string, 
    roleId: string, 
    status?: string,
    officeId?: string,
    departmentId?: string,
    divisionId?: string,
    districtId?: string,
    branchId?: string,
}) {
    await hasPermission('manage_users');
    const payload: any = {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        status: data.status ?? 'active',
        officeId: data.officeId || null,
        departmentId: data.departmentId || null,
        divisionId: data.divisionId || null,
        districtId: data.districtId || null,
        branchId: data.branchId || null,
    };

    if (data.id) {
        const existingUser = await prisma.user.findUnique({ where: { id: data.id } });
        if (existingUser && existingUser.email !== data.email) {
            const emailInUse = await prisma.user.findUnique({ where: { email: data.email } });
            if (emailInUse) {
                return { error: `The email ${data.email} is already in use by another user.` };
            }
        }
        
        if (existingUser && (existingUser.roleId !== data.roleId || existingUser.status !== data.status)) {
            payload.tokenVersion = { increment: 1 };
        }
        
        await prisma.user.update({ where: { id: data.id }, data: payload });
    } else {
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
        if (existingUser) {
            return { error: `A user with the email ${data.email} already exists.` };
        }

        const password = generateStrongPassword();
        const validation = await passwordSchema.safeParseAsync(password);
        if (!validation.success) {
            return { error: validation.error.issues.map(i => i.message).join(' ') };
        }
        payload.hashedPassword = await bcrypt.hash(password, 10);
        payload.mustChangePassword = true;
        
        const newUser = await prisma.user.create({ data: payload });
        
        try {
            await sendWelcomeEmail({ to: newUser.email, name: newUser.name, password: password });
        } catch (error) {
            console.error(`Failed to send welcome email to ${newUser.email}:`, error);
        }
    }
    
    revalidatePath('/dashboard/admin/users');
    return { success: true };
}

export async function deleteUser(userId: string) {
    await hasPermission('manage_users');
    const memoCount = await prisma.memo.count({ where: { fromId: userId } });
    if (memoCount > 0) {
        return { error: `Cannot delete user. They are the author of ${memoCount} memo(s). Please reassign them first.` };
    }
    
    try {
        await prisma.user.delete({ where: { id: userId }});
        revalidatePath('/dashboard/admin/users');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: 'An unexpected error occurred while deleting the user.' };
    }
}


export async function resetUserPassword(userId: string) {
    await hasPermission('manage_users');
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }});
        if (!user) {
            return { success: false, error: 'User not found.' };
        }

        const password = generateStrongPassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { 
                hashedPassword,
                mustChangePassword: true,
                tokenVersion: { increment: 1 },
            }
        });
        
        try {
            await sendPasswordResetEmail({ to: user.email, name: user.name, password: password });
        } catch (error) {
             console.error(`Failed to send password reset email to ${user.email}:`, error);
        }

        revalidatePath('/dashboard/admin/users');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to reset password.' };
    }
}

export async function changeUserPassword(password: string) {
    try {
        const user = await getLoggedInUser();
        if (!user) return { success: false, error: 'Not authenticated.' };

        const validation = await passwordSchema.safeParseAsync(password);
        if (!validation.success) {
            return { success: false, error: validation.error.issues.map(i => i.message).join(' ') };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                hashedPassword,
                mustChangePassword: false,
                tokenVersion: { increment: 1 },
            }
        });
        
        revalidatePath('/dashboard/inbox');
        return { success: true };
    } catch (error) {
        console.error("Password change error:", error);
        return { success: false, error: 'Failed to change password.' };
    }
}


export async function saveRole(data: { id?: string, name: string, permissions: any }) {
    await hasPermission('manage_roles');
    if (data.id) {
        await prisma.role.update({ where: { id: data.id }, data: { ...data, permissions: data.permissions.join(',') } });
    } else {
        await prisma.role.create({ data: { ...data, permissions: data.permissions.join(',') } });
    }
    revalidatePath('/dashboard/admin/roles');
}

export async function deleteRole(roleId: string) {
    await hasPermission('manage_roles');
    const usersInRole = await prisma.user.count({ where: { roleId }});
    if (usersInRole > 0) {
        return { error: 'Cannot delete role. It is currently assigned to one or more users.' };
    }
    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath('/dashboard/admin/roles');
    return { success: true };
}

export async function saveLabel(data: { id?: string, name: string, color: string, type: 'SYSTEM' | 'USER' }) {
    await hasPermission('manage_labels');
    if (data.id) {
        await prisma.label.update({ where: { id: data.id }, data });
    } else {
        await prisma.label.create({ data });
    }
    revalidatePath('/dashboard/admin/labels');
    return { success: true };
}

export async function deleteLabel(id: string) {
    await hasPermission('manage_labels');
    const label = await prisma.label.findUnique({ where: { id }});
    if (!label) return { error: "Label not found." };
    if (label.type === 'SYSTEM') return { error: "Cannot delete a system label." };
    await prisma.label.delete({ where: { id } });
    revalidatePath('/dashboard/admin/labels');
    return { success: true };
}

export async function updateUserProfile(userId: string, data: { name: string, email: string, avatar?: string, signature?: string }) {
    const user = await getLoggedInUser();
    if (!user || (user.id !== userId && !user.actingUser)) {
      throw new Error("Unauthorized");
    }

    if (data.email) {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (currentUser && currentUser.email !== data.email) {
            const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
            if (existingUser) {
                return { success: false, error: "Email is already in use by another account." };
            }
        }
    }

    await prisma.user.update({ where: { id: userId }, data: data });
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard');
    return { success: true };
}

export type BulkImportResult = {
    successCount: number;
    errorCount: number;
    errors: { rowIndex: number; email: string; error: string }[];
};

type UserDataRow = { 
    name?: string; 
    email?: string; 
    role?: string; 
    office?: string;
    department?: string;
    division?: string;
    district?: string;
    branch?: string;
};

async function parseFileData(fileData: string): Promise<UserDataRow[]> {
    return new Promise((resolve) => {
        Papa.parse(fileData, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => resolve(result.data as UserDataRow[]),
        });
    });
}

export async function bulkImportUsers(fileData: string): Promise<BulkImportResult> {
    await hasPermission('manage_users');

    const result: BulkImportResult = { successCount: 0, errorCount: 0, errors: [] };
    
    const [allRoles, allOffices, allDepartments, allDivisions, allDistricts, allBranches, existingUsers] = await Promise.all([
        prisma.role.findMany(),
        prisma.office.findMany(),
        prisma.department.findMany(),
        prisma.division.findMany(),
        prisma.district.findMany(),
        prisma.branch.findMany(),
        prisma.user.findMany({ select: { email: true } })
    ]);

    const existingEmails = new Set(existingUsers.map(u => u.email));
    
    const roleMap = new Map(allRoles.map(r => [r.name.toLowerCase(), r.id]));
    const officeMap = new Map(allOffices.map(o => [o.name.toLowerCase(), o.id]));
    const departmentMap = new Map(allDepartments.map(d => [d.name.toLowerCase(), { id: d.id, officeId: d.officeId }]));
    const divisionMap = new Map(allDivisions.map(d => [d.name.toLowerCase(), { id: d.id, departmentId: d.departmentId }]));
    const districtMap = new Map(allDistricts.map(d => [d.name.toLowerCase(), { id: d.id, officeId: d.officeId }]));
    const branchMap = new Map(allBranches.map(b => [b.name.toLowerCase(), { id: b.id, districtId: b.districtId }]));

    let rows: UserDataRow[];
    try {
        rows = await parseFileData(fileData);
    } catch(e: any) {
        result.errorCount++;
        result.errors.push({ rowIndex: 1, email: 'File Level', error: e.message || "Failed to parse file." });
        return result;
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowIndex = i + 2;
        const { name, email, role: roleName, office: officeName, department: deptName, division: divName, district: distName, branch: branchName } = row;

        if (!name || !email || !roleName || !officeName) {
            result.errorCount++;
            result.errors.push({ rowIndex, email: email || `Row ${rowIndex}`, error: "Missing required fields (name, email, role, office)." });
            continue;
        }
        
        const emailValidation = z.string().email().safeParse(email);
        if (!emailValidation.success) {
            result.errorCount++;
            result.errors.push({ rowIndex, email, error: "Invalid email format." });
            continue;
        }

        if (existingEmails.has(email)) {
            result.errorCount++;
            result.errors.push({ rowIndex, email, error: "Email already exists." });
            continue;
        }

        const roleId = roleMap.get(roleName.toLowerCase());
        if (!roleId) {
            result.errorCount++;
            result.errors.push({ rowIndex, email, error: `Role '${roleName}' not found.` });
            continue;
        }

        const officeId = officeMap.get(officeName.toLowerCase());
        if (!officeId) {
            result.errorCount++;
            result.errors.push({ rowIndex, email, error: `Office '${officeName}' not found.` });
            continue;
        }
        
        let departmentId, divisionId, districtId, branchId;
        if(deptName) {
            const dept = departmentMap.get(deptName.toLowerCase());
            if (!dept || dept.officeId !== officeId) {
                result.errorCount++;
                result.errors.push({ rowIndex, email, error: `Department '${deptName}' not in office '${officeName}'.` });
                continue;
            }
            departmentId = dept.id;
        }
        if(divName) {
            const div = divisionMap.get(divName.toLowerCase());
            if (!div || !departmentId || div.departmentId !== departmentId) {
                result.errorCount++;
                result.errors.push({ rowIndex, email, error: `Division '${divName}' not in department '${deptName}'.` });
                continue;
            }
            divisionId = div.id;
        }
        if(distName) {
            const dist = districtMap.get(distName.toLowerCase());
            if (!dist || dist.officeId !== officeId) {
                result.errorCount++;
                result.errors.push({ rowIndex, email, error: `District '${distName}' not in office '${officeName}'.` });
                continue;
            }
            districtId = dist.id;
        }
        if(branchName) {
            const branch = branchMap.get(branchName.toLowerCase());
            if (!branch || !districtId || branch.districtId !== districtId) {
                result.errorCount++;
                result.errors.push({ rowIndex, email, error: `Branch '${branchName}' not in district '${distName}'.` });
                continue;
            }
            branchId = branch.id;
        }

        const password = generateStrongPassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        
        try {
            const newUser = await prisma.user.create({
                data: {
                    name, email, roleId, officeId,
                    departmentId: departmentId || null, divisionId: divisionId || null,
                    districtId: districtId || null, branchId: branchId || null,
                    hashedPassword, mustChangePassword: true, status: 'active',
                },
            });

            try { await sendWelcomeEmail({ to: newUser.email, name: newUser.name, password }); } 
            catch (emailError) { console.error(`Failed to send welcome email to ${newUser.email}:`, emailError); }

            existingEmails.add(email);
            result.successCount++;

        } catch (dbError) {
            console.error('DB error during bulk import:', dbError);
            result.errorCount++;
            result.errors.push({ rowIndex, email, error: "Database error." });
        }
    }
    
    revalidatePath('/dashboard/admin/users');
    return result;
}


export async function getEmailSettings() {
    const settings = await prisma.setting.findUnique({ where: { key: 'email' } });
    const defaultSettings = { 
        notificationsEnabled: true, 
        headerText: 'New Memo Notification', 
        bodyText: 'Hello,\n\n{{notificationType}}\n\nPlease find the details of the memo below.',
        footerText: 'This is an automated message. Please do not reply.' 
    };
    return settings ? { ...defaultSettings, ...(settings.value as any) } : defaultSettings;
}

export async function saveEmailSettings(settings: { notificationsEnabled: boolean, headerText: string, bodyText: string, footerText: string }) {
    await hasPermission('manage_email_settings');
    await prisma.setting.upsert({
        where: { key: 'email' },
        update: { value: settings },
        create: { key: 'email', value: settings }
    });
    revalidatePath('/dashboard/admin/email');
    return { success: true };
}

const defaultGeneralSettings = { 
    acknowledgementType: 'SIGNATURE' as AcknowledgementType,
    referenceFormat: {
        prefix: 'department' as 'department' | 'office' | 'custom',
        separator: '-' as '-' | '/',
        numberLength: 4,
    },
    acknowledgementMode: 'manual' as 'auto' | 'manual',
};

export async function getGeneralSettings() {
    const settings = await prisma.setting.findUnique({ where: { key: 'general' } });
    if (settings) {
        const dbSettings = settings.value as any;
        const mergedSettings = { ...defaultGeneralSettings, ...dbSettings };
        mergedSettings.referenceFormat = { ...defaultGeneralSettings.referenceFormat, ...dbSettings.referenceFormat };
        return mergedSettings;
    }
    return defaultGeneralSettings;
}

export async function saveGeneralSettings(settings: { acknowledgementType: AcknowledgementType; referenceFormat: any; acknowledgementMode: 'auto' | 'manual' }) {
    await hasPermission('manage_general_settings');
    await prisma.setting.upsert({
        where: { key: 'general' },
        update: { value: settings },
        create: { key: 'general', value: settings }
    });
    revalidatePath('/dashboard/admin/general');
    return { success: true };
}

export async function performBulkArchiveActions(action: 'archive' | 'restore' | 'delete', memoIds: string[]) {
    if (memoIds.length === 0) return { error: 'No memos selected.' };

    const user = await hasPermission('manage_archive');

    if (action === 'delete') {
        await prisma.attachment.deleteMany({ where: { memoId: { in: memoIds } } });
        await prisma.activity.deleteMany({ where: { memoId: { in: memoIds } } });
        await prisma.memo.updateMany({ where: { replyToId: { in: memoIds } }, data: { replyToId: null } });
        await prisma.memo.deleteMany({ where: { id: { in: memoIds } } });
    } else if (action === 'restore') {
        const memosToRestore = await prisma.memo.findMany({ where: { id: { in: memoIds } }, select: { id: true, archivedBy: { select: { id: true } } } });
        for (const memo of memosToRestore) {
            await prisma.memo.update({ where: { id: memo.id }, data: { archivedBy: { disconnect: memo.archivedBy.map(u => ({ id: u.id })) } } });
        }
    }
    
    revalidatePath('/dashboard/admin/archive');
    revalidatePath('/dashboard/inbox');
    return { success: true };
}

export async function revokeUserTokens(userId: string) {
    const user = await getLoggedInUser();
    if (!user || (user.id !== userId && !user.role?.permissions.includes('manage_users'))) {
        throw new Error("Unauthorized");
    }
    
    await prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } }
    });
    return { success: true };
}

export async function getEmailLogs(page = 1, limit = 10, filters: { status?: string; query?: string } = {}) {
    await hasPermission('manage_email_settings');
    
    const where: Prisma.EmailLogWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.query) {
        where.OR = [
            { to: { contains: filters.query, mode: 'insensitive' } },
            { subject: { contains: filters.query, mode: 'insensitive' } },
            { relatedEntityId: { contains: filters.query, mode: 'insensitive' } },
        ];
    }

    const [logs, total] = await prisma.$transaction([
        prisma.emailLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }}),
        prisma.emailLog.count({ where })
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function completeOnboardingTour() {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    await prisma.user.update({
        where: { id: user.id },
        data: { onboardingCompleted: true }
    });
    revalidatePath('/dashboard');
    return { success: true };
}

export async function addOrUpdateDelegate(data: { delegateId: string, permissions: DelegationPermission[] }) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const existingDelegation = await prisma.delegation.findUnique({
        where: { delegatorId_delegateId: { delegatorId: user.id, delegateId: data.delegateId } }
    });

    if (existingDelegation) {
        await prisma.delegation.update({ where: { id: existingDelegation.id }, data: { permissions: data.permissions.join(',') } });
    } else {
        await prisma.delegation.create({ data: { delegatorId: user.id, delegateId: data.delegateId, permissions: data.permissions.join(',') } });
    }
    revalidatePath('/dashboard/profile');
}

export async function removeDelegate(delegationId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const delegation = await prisma.delegation.findUnique({ where: { id: delegationId } });
    if (delegation?.delegatorId !== user.id) {
        throw new Error("You are not authorized to remove this delegation.");
    }

    await prisma.delegation.delete({ where: { id: delegationId } });
    revalidatePath('/dashboard/profile');
}
