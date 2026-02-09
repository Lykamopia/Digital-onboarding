

'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { Memo, User, Label, AcknowledgementType, Permission, Role, Office, Prisma, DelegationPermission, LoggedInUser, Activity } from '@/lib/types';
import { LogSeverity } from '@/lib/types';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerificationEmail, sendEmailChangeNotificationEmail } from '@/lib/email';
import WebSocket from 'ws';
import { redirect } from 'next/navigation';
import { passwordSchema } from '@/lib/password-policy';
import Papa from 'papaparse';
import { randomBytes, createHash } from 'crypto';
import { getGeneralSettings, getEmailSettings } from './settings';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';

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
        await logSecurityEvent({
            event: SecurityEvent.PERMISSION_DENIED,
            severity: LogSeverity.WARN,
            actor: user,
            details: `User '${user.name}' (ID: ${user.id}) denied permission for: ${requiredPermissions.join(', ')}.`,
        });
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

    if (user.actingUser && !user.delegationPermissions?.includes('delegation:view')) {
      return []; // If no view permission, return nothing.
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
            from: { select: { id: true, name: true, avatar: true } },
            to: { select: { id: true, name: true } },
            cc: { select: { id: true, name: true } },
            labels: true,
            acknowledgedBy: { where: { id: userId }, select: { id: true } },
            archivedBy: { where: { id: userId }, select: { id: true } },
            activity: {
                where: { action: { in: ['viewed', 'replied', 'assigned'] } },
                select: { action: true, actorId: true },
            },
            favoritedBy: { where: { id: userId }, select: { id: true } },
            flaggedBy: { where: { id: userId }, select: { id: true } },
            current_holder: { select: { id: true } },
        },
        orderBy: [
            { favoritedBy: { _count: 'desc' } }, // favorited memos first
            { createdAt: 'desc' }
        ]
    });
    return memos;
}

export async function getAuditMemos(
  page = 1,
  limit = 10,
  filters: {
    query?: string;
    sender?: string;
    recipient?: string;
    status?: string;
    labels?: string[];
    dateRange?: { from?: string; to?: string };
  } = {}
) {
  await hasPermission('manage_audit_log');

  const whereClause: Prisma.MemoWhereInput = {
    status: { not: 'draft' }
  };
  
  const andClauses: Prisma.MemoWhereInput[] = [];

  if (filters.query) {
    andClauses.push({
      OR: [
        { subject: { contains: filters.query, mode: 'insensitive' } },
        { memo_reference_number: { contains: filters.query, mode: 'insensitive' } }
      ]
    });
  }

  if (filters.sender) {
    andClauses.push({ fromId: filters.sender });
  }

  if (filters.recipient) {
    andClauses.push({
        OR: [
            { to: { some: { id: filters.recipient } } },
            { cc: { some: { id: filters.recipient } } }
        ]
    });
  }

  if (filters.status) {
    if (filters.status === 'acknowledged') {
      andClauses.push({ acknowledgedBy: { some: {} } });
    } else {
      andClauses.push({ status: filters.status });
    }
  }

  if (filters.labels && filters.labels.length > 0) {
    andClauses.push({ labels: { some: { id: { in: filters.labels } } } });
  }

  const dateFilter: { gte?: Date, lte?: Date } = {};
  if (filters.dateRange?.from) {
    dateFilter.gte = new Date(filters.dateRange.from);
  }
  if (filters.dateRange?.to) {
    dateFilter.lte = new Date(filters.dateRange.to);
  }
  if (Object.keys(dateFilter).length > 0) {
      andClauses.push({ createdAt: dateFilter });
  }

  if (andClauses.length > 0) {
      whereClause.AND = andClauses;
  }

  const [memos, total] = await prisma.$transaction([
    prisma.memo.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        from: { include: { role: true } },
        to: { include: { role: true } },
        cc: { include: { role: true } },
        labels: true,
        attachments: true,
        activity: {
          include: { actor: true },
          orderBy: { timestamp: 'asc' }
        },
        current_holder: { include: { role: true } },
        previous_holders: { include: { role: true } },
        acknowledgedBy: { include: { role: true } },
        replies: {
          include: { from: { include: { role: true } } },
        },
        replyTo: { include: { from: { include: { role: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.memo.count({ where: whereClause })
  ]);

  return { memos, total, page, limit, totalPages: Math.ceil(total / limit) };
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
                where: {
                    action: 'viewed',
                    OR: [
                        { actorId: user.id },
                        ...(user.actingUser ? [{ actorId: user.actingUser.id }] : [])
                    ]
                }
            },
            acknowledgedBy: {
                where: { id: user.id }
            },
            to: { select: { id: true } },
            cc: { select: { id: true } },
            current_holder: { select: { id: true } },
        }
    });

    if (!memo) return;

    const hasAlreadyViewed = memo.activity.length > 0;
    
    if (!hasAlreadyViewed) {
        await prisma.activity.create({
            data: {
                memoId: memoId,
                actorId: actorId,
                action: 'viewed',
            }
        });

        const { acknowledgementMode } = await getGeneralSettings();
        const hasDelegatorAcknowledged = memo.acknowledgedBy.some(u => u.id === user.id);

        if (acknowledgementMode === 'auto' && !hasDelegatorAcknowledged) {
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
    
    let details = 'Marked as read via "Mark all as read"';
    if (user.actingUser) {
        details = `Marked as read by **${user.actingUser.name}** on behalf of **${user.name}** via "Mark all as read".`;
    }

    await prisma.activity.createMany({
        data: unreadMemos.map(memo => ({
            memoId: memo.id,
            actorId: actorId,
            action: 'viewed',
            details: details
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
            division: true,
            district: true,
            branch: true,
        }
    });

    if (!userWithRelations) throw new Error("User not found for reference generation.");

    const orgParts: string[] = [];

    // Always start with the office code if it exists
    if (userWithRelations.office) {
        orgParts.push(userWithRelations.office.code);
    }

    // Add department and division if they exist and user is associated with a department
    if (userWithRelations.department) {
        orgParts.push(userWithRelations.department.code);
        if (userWithRelations.division) {
            orgParts.push(userWithRelations.division.code);
        }
    } 
    // Otherwise, add district and branch if they exist
    else if (userWithRelations.district) {
        orgParts.push(userWithRelations.district.code);
        if (userWithRelations.branch) {
            orgParts.push(userWithRelations.branch.code);
        }
    }
    
    const orgPrefix = orgParts.join(format.separator);
    const year = new Date().getFullYear();
    const fullPrefix = `${orgPrefix}${format.separator}${year}${format.separator}`;

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


export async function sendMemo(formData: FormData): Promise<{ success: boolean; error?: any; memo?: Memo; }> {
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
        return { success: false, error: validation.error.flatten().fieldErrors };
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
    
    const actionVerb = isScheduled ? 'scheduled' : 'sent';
    let activityDetails = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} to recipients.`;
    if (user.actingUser) {
      activityDetails = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} by **${user.actingUser.name}** on behalf of **${user.name}**.`;
    }
    if (isScheduled) {
        activityDetails += ` for ${validatedData.scheduledFor?.toLocaleString()}`;
    }

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
        activity: { create: [{ actorId: actorId, action: actionVerb, details: activityDetails }] },
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
        
        let assignDetails = `Assigned to ${recipients}.\n<b>Remark:</b> ${newMemo.body.split('<hr>')[0]}`;
        let ackDetails = `Acknowledged receipt of the memo by assigning it.`;
        if (user.actingUser) {
            assignDetails = `Assigned by **${user.actingUser.name}** on behalf of **${user.name}** to ${recipients}.\n<b>Remark:</b> ${newMemo.body.split('<hr>')[0]}`;
            ackDetails = `Acknowledged by **${user.actingUser.name}** on behalf of **${user.name}** by assigning the memo.`;
        }

        await prisma.memo.update({
            where: { id: validatedData.assignFrom },
            data: {
                acknowledgedBy: { connect: { id: user.id } },
                activity: {
                    create: [
                        { actorId: actorId, action: 'assigned', details: assignDetails },
                        { actorId: actorId, action: 'acknowledged', details: ackDetails }
                    ]
                }
            }
        });
    }

    if (validatedData.replyTo) {
        let replyDetails = `Replied to this memo. See memo ${newMemo.memo_reference_number}`;
        if (user.actingUser) {
            replyDetails = `Replied by **${user.actingUser.name}** on behalf of **${user.name}**. See memo ${newMemo.memo_reference_number}`;
        }
        await prisma.memo.update({
            where: { id: validatedData.replyTo },
            data: {
                activity: { create: { actorId: actorId, action: 'replied', details: replyDetails } }
            }
        });
    }

    const draftId = formData.get('draftId') as string;
    if (draftId) {
        // First, disconnect many-to-many relations and delete related one-to-many records
        await prisma.memo.update({
            where: { id: draftId },
            data: {
                to: { set: [] },
                cc: { set: [] },
                labels: { set: [] },
            },
        });
        await prisma.attachment.deleteMany({ where: { memoId: draftId } });
        await prisma.activity.deleteMany({ where: { memoId: draftId } });

        // Now, safely delete the memo
        await prisma.memo.delete({ where: { id: draftId } });
    }
    
    if (isScheduled) {
        revalidatePath('/dashboard/scheduled');
        return { success: true, memo: newMemo };
    }

    await sendToWebSocket({ type: 'new-memo', payload: newMemo });
    
    const [emailSettings, generalSettings] = await Promise.all([
        getEmailSettings(),
        getGeneralSettings(),
    ]);

    const allRecipients = [...newMemo.to, ...newMemo.cc];
    for (const recipient of allRecipients) {
        try {
            await sendEmail({
                to: recipient.email,
                subject: `New Memo: ${newMemo.subject}`,
                memo: newMemo,
                sender: user,
                type: newMemo.to.some(u => u.id === recipient.id) ? 'direct' : 'cc',
                emailSettings,
                generalSettings,
            });
        } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
        }
    }

    revalidatePath('/dashboard/inbox');
    return { success: true, memo: newMemo };
}

export async function saveDraft(data: Partial<Memo> & { to?: User[], cc?: User[], labels?: LabelType[] }, draftId?: string | null): Promise<{ success: boolean; error?: string; draft?: Memo; }> {
    const user = await getLoggedInUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const isReplyingOrAssigningDraft = data.replyToId || data.assignedFromId;
    if (user.actingUser) {
        const requiredPermission = isReplyingOrAssigningDraft ? 'delegation:reply' : 'delegation:draft';
        if (!user.delegationPermissions?.includes(requiredPermission)) {
            const action = isReplyingOrAssigningDraft ? 'draft replies or assignments' : 'create drafts';
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
        const newDraft = await prisma.memo.create({ data: payload, include: { to: true, cc: true, labels: true, attachments: true } });
        return { success: true, draft: newDraft };
    }
}

export async function getOrCreateActionDraft(originalMemoId: string, action: 'reply' | 'assign', initialData: Partial<Memo> & { to?: User[], cc?: User[], labels?: LabelType[] } = {}) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    if (user.actingUser && !user.delegationPermissions?.includes('delegation:reply')) {
        throw new Error("Access Denied: You do not have permission to draft replies or assignments.");
    }

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
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    if (user.actingUser && !user.delegationPermissions?.includes('delegation:draft')) {
      throw new Error("Access Denied: You do not have permission to duplicate memos.");
    }
    await hasPermission('manage_memos');

    const originalMemo = await prisma.memo.findUnique({ where: { id: memoId }, include: { to: true, cc: true, attachments: true, labels: true }});
    if (!originalMemo) throw new Error("Memo not found");

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

  let ackDetails = 'Acknowledged receipt of the memo.';
  if (user.actingUser) {
    ackDetails = `Acknowledged by **${user.actingUser.name}** on behalf of **${user.name}**.`;
  }

  const updateData: any = {
    acknowledgedBy: { connect: { id: user.id } },
    activity: { create: { actorId: actorId, action: 'acknowledged', details: ackDetails } },
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

  const actionVerb = archive ? 'archived' : 'unarchived';
  let details = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} the memo.`;
  if (user.actingUser) {
      details = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} by **${user.actingUser.name}** on behalf of **${user.name}**.`;
  }

  const data = archive ? 
    { archivedBy: { connect: { id: user.id } } } :
    { archivedBy: { disconnect: { id: user.id } } };
    
  await prisma.memo.update({
      where: { id: memoId },
      data: {
          ...data,
          activity: { create: { actorId: actorId, action: actionVerb, details: details } }
      }
  });

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard?id=${memoId}`);
}


export async function getUsers() {
    const users = await prisma.user.findMany({
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

    // Sanitize user data to remove password hashes before returning
    return users.map(user => {
        const { hashedPassword, ...userWithoutPassword } = user;
        return userWithoutPassword;
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
    return await prisma.district.findMany({ include: { office: true } });
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
    if (!session?.user?.id) {
        return null;
    }
    const sessionUser = session.user as any;

    const currentUserId = sessionUser.id;
    const realUserId = sessionUser.isDelegated ? sessionUser.realUser.id : sessionUser.id;

    if (!currentUserId || !realUserId) {
        return null; // One of the IDs is missing, invalid session state
    }

    const userInclude = {
        role: true,
        office: true,
        department: true,
        division: true,
        district: true,
        branch: true,
        delegations: { include: { delegate: true } },
    };

    const [currentUser, realUserWithDelegations] = await Promise.all([
        prisma.user.findUnique({
            where: { id: currentUserId },
            include: userInclude
        }),
        realUserId ? prisma.user.findUnique({
            where: { id: realUserId },
            include: {
                delegatedTo: { include: { delegator: true } }
            }
        }) : Promise.resolve(null),
    ]);

    if (!currentUser || !realUserWithDelegations) return null;
    
    // Sanitize passwords
    (currentUser as any).hashedPassword = null;
    if (currentUser.delegations) {
        for (const delegation of currentUser.delegations) {
            if (delegation.delegate) {
                (delegation.delegate as any).hashedPassword = null;
            }
        }
    }

    if (realUserWithDelegations.delegatedTo) {
        for (const delegation of realUserWithDelegations.delegatedTo) {
            if (delegation.delegator) {
                (delegation.delegator as any).hashedPassword = null;
            }
        }
    }

    if (currentUser.status === 'inactive') {
        return null;
    }

    const finalUser: LoggedInUser = {
        ...currentUser,
        onboardingCompleted: currentUser.onboardingCompleted,
        delegatedTo: realUserWithDelegations.delegatedTo, // Always use the real user's delegatedTo list
    };
    
    if (sessionUser.isDelegated) {
        finalUser.actingUser = sessionUser.realUser;
        finalUser.delegationPermissions = sessionUser.delegationPermissions;
    }

    return finalUser;
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
    const user = await hasPermission('manage_divisions');
    if (data.id) {
        await prisma.division.update({ where: { id: data.id }, data });
        await logSecurityEvent({ event: SecurityEvent.DIVISION_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Updated division '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'Division' });
    } else {
        const newDivision = await prisma.division.create({ data });
        await logSecurityEvent({ event: SecurityEvent.DIVISION_CREATED, severity: LogSeverity.INFO, actor: user, details: `Created new division '${data.name}'.`, targetId: newDivision.id, targetType: 'Division' });
    }
    revalidatePath('/dashboard/admin/divisions');
}

export async function deleteDivision(id: string) {
    const user = await hasPermission('manage_divisions');
    const users = await prisma.user.count({ where: { divisionId: id }});
    if (users > 0) {
        return { error: 'Cannot delete division. It has associated users. Please reassign them first.' };
    }
    const division = await prisma.division.findUnique({ where: { id } });
    if (division) {
        await logSecurityEvent({ event: SecurityEvent.DIVISION_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted division '${division.name}' (ID: ${id}).`, targetId: id, targetType: 'Division' });
    }
    await prisma.division.delete({ where: { id } });
    revalidatePath('/dashboard/admin/divisions');
    return { success: true };
}


export async function saveDepartment(data: { id?: string, name: string, code: string, officeId: string }) {
    const user = await hasPermission('manage_departments');
    if (data.id) {
        await prisma.department.update({ where: { id: data.id }, data });
        await logSecurityEvent({ event: SecurityEvent.DEPARTMENT_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Updated department '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'Department' });
    } else {
        const newDept = await prisma.department.create({ data });
        await logSecurityEvent({ event: SecurityEvent.DEPARTMENT_CREATED, severity: LogSeverity.INFO, actor: user, details: `Created new department '${data.name}'.`, targetId: newDept.id, targetType: 'Department' });
    }
    revalidatePath('/dashboard/admin/departments');
}

export async function deleteDepartment(id: string) {
    const user = await hasPermission('manage_departments');
    const divisions = await prisma.division.count({ where: { departmentId: id } });
    if (divisions > 0) {
        return { error: 'Cannot delete department. It has associated divisions. Please delete them first.' };
    }
    const department = await prisma.department.findUnique({ where: { id } });
    if (department) {
        await logSecurityEvent({ event: SecurityEvent.DEPARTMENT_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted department '${department.name}' (ID: ${id}).`, targetId: id, targetType: 'Department' });
    }
    await prisma.department.delete({ where: { id } });
    revalidatePath('/dashboard/admin/departments');
    return { success: true };
}

export async function saveBranch(data: { id?: string, name: string, code: string, districtId: string }) {
    const user = await hasPermission('manage_branches');
    if (data.id) {
        await prisma.branch.update({ where: { id: data.id }, data });
        await logSecurityEvent({ event: SecurityEvent.BRANCH_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Updated branch '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'Branch' });
    } else {
        const newBranch = await prisma.branch.create({ data });
        await logSecurityEvent({ event: SecurityEvent.BRANCH_CREATED, severity: LogSeverity.INFO, actor: user, details: `Created new branch '${data.name}'.`, targetId: newBranch.id, targetType: 'Branch' });
    }
    revalidatePath('/dashboard/admin/branches');
}

export async function deleteBranch(id: string) {
    const user = await hasPermission('manage_branches');
    const users = await prisma.user.count({ where: { branchId: id }});
    if (users > 0) {
        return { error: 'Cannot delete branch. It has associated users. Please reassign them first.' };
    }
    const branch = await prisma.branch.findUnique({ where: { id } });
    if(branch) {
        await logSecurityEvent({ event: SecurityEvent.BRANCH_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted branch '${branch.name}' (ID: ${id}).`, targetId: id, targetType: 'Branch' });
    }
    await prisma.branch.delete({ where: { id } });
    revalidatePath('/dashboard/admin/branches');
    return { success: true };
}

export async function saveDistrict(data: { id?: string, name: string, code: string, officeId: string }) {
    const user = await hasPermission('manage_districts');
    if (data.id) {
        await prisma.district.update({ where: { id: data.id }, data });
        await logSecurityEvent({ event: SecurityEvent.DISTRICT_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Updated district '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'District' });
    } else {
        const newDistrict = await prisma.district.create({ data });
        await logSecurityEvent({ event: SecurityEvent.DISTRICT_CREATED, severity: LogSeverity.INFO, actor: user, details: `Created new district '${data.name}'.`, targetId: newDistrict.id, targetType: 'District' });
    }
    revalidatePath('/dashboard/admin/districts');
}

export async function deleteDistrict(id: string) {
    const user = await hasPermission('manage_districts');
    const branches = await prisma.branch.count({ where: { districtId: id } });
    if (branches > 0) {
        return { error: 'Cannot delete district. It has associated branches. Please delete them first.' };
    }
    const district = await prisma.district.findUnique({ where: { id } });
    if (district) {
        await logSecurityEvent({ event: SecurityEvent.DISTRICT_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted district '${district.name}' (ID: ${id}).`, targetId: id, targetType: 'District' });
    }
    await prisma.district.delete({ where: { id } });
    revalidatePath('/dashboard/admin/districts');
    return { success: true };
}

export async function saveOffice(data: { id?: string, name: string, code: string, type?: 'division_office' | 'branch_office' | 'head_office' }) {
    const user = await hasPermission('manage_offices');
    const payload = {
        name: data.name,
        code: data.code,
        type: data.type || 'branch_office'
    };
    if (data.id) {
        await prisma.office.update({ where: { id: data.id }, data: payload });
        await logSecurityEvent({ event: SecurityEvent.OFFICE_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Updated office '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'Office' });
    } else {
        const newOffice = await prisma.office.create({ data: payload });
        await logSecurityEvent({ event: SecurityEvent.OFFICE_CREATED, severity: LogSeverity.INFO, actor: user, details: `Created new office '${data.name}'.`, targetId: newOffice.id, targetType: 'Office' });
    }
    revalidatePath('/dashboard/admin/offices');
}

export async function deleteOffice(id: string) {
    const user = await hasPermission('manage_offices');
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

    const office = await prisma.office.findUnique({ where: { id } });
    if (office) {
        await logSecurityEvent({ event: SecurityEvent.OFFICE_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted office '${office.name}' (ID: ${id}).`, targetId: id, targetType: 'Office' });
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
    const user = await hasPermission('manage_users');
    const payload: any = {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        status: data.status,
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
        await logSecurityEvent({ event: SecurityEvent.USER_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Admin updated user profile for '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'User' });

    } else {
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
        if (existingUser) {
            return { error: `A user with the email ${data.email} already exists.` };
        }

        payload.hashedPassword = null;
        payload.onboardingCompleted = false;
        payload.status = 'pending';
        
        const newUser = await prisma.user.create({ data: payload });
        await logSecurityEvent({ event: SecurityEvent.USER_CREATED, severity: LogSeverity.WARN, actor: user, details: `Admin created new user '${newUser.name}' (ID: ${newUser.id}).`, targetId: newUser.id, targetType: 'User' });


        const token = randomBytes(32).toString('hex');
        const hashedToken = createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.upsert({
            where: { email: newUser.email! },
            update: { token: hashedToken, expires },
            create: { email: newUser.email!, token: hashedToken, expires },
        });
        
        try {
            await sendVerificationEmail({ to: newUser.email!, name: newUser.name!, token: token });
        } catch (error) {
            console.error(`Failed to send welcome email to ${newUser.email}:`, error);
        }
    }
    
    revalidatePath('/dashboard/admin/users');
    return { success: true };
}

export async function deleteUser(userId: string) {
    const user = await hasPermission('manage_users');
    const memoCount = await prisma.memo.count({ where: { fromId: userId } });
    if (memoCount > 0) {
        return { error: `Cannot delete user. They are the author of ${memoCount} memo(s). Please reassign them first.` };
    }
    
    try {
        await logSecurityEvent({ event: SecurityEvent.USER_DELETED, severity: LogSeverity.CRITICAL, actor: user, details: `Admin deleted user with ID: ${userId}.`, targetId: userId, targetType: 'User' });
        await prisma.user.delete({ where: { id: userId }});
        revalidatePath('/dashboard/admin/users');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: 'An unexpected error occurred while deleting the user.' };
    }
}


export async function resetUserPassword(userId: string) {
    const admin = await hasPermission('manage_users');
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }});
        if (!user || !user.email) {
            return { success: false, error: 'User not found or has no email.' };
        }

        const token = randomBytes(32).toString('hex');
        const hashedToken = createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.upsert({
            where: { email: user.email },
            update: { token: hashedToken, expires },
            create: { email: user.email, token: hashedToken, expires },
        });
        
        await logSecurityEvent({ event: SecurityEvent.PASSWORD_RESET_REQUEST, severity: LogSeverity.WARN, actor: admin, details: `Admin initiated password reset for user '${user.name}' (ID: ${userId}).`, targetId: userId, targetType: 'User' });

        try {
            await sendPasswordResetEmail({ to: user.email, name: user.name!, token: token });
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
                onboardingCompleted: true, // Mark onboarding as complete
                tokenVersion: { increment: 1 },
            }
        });
        
        await logSecurityEvent({ event: SecurityEvent.PASSWORD_CHANGE_SUCCESS, severity: LogSeverity.INFO, actor: user, details: `User '${user.name}' (ID: ${user.id}) successfully changed their password.`, targetId: user.id, targetType: 'User' });
        
        revalidatePath('/dashboard/inbox');
        return { success: true };
    } catch (error) {
        console.error("Password change error:", error);
        return { success: false, error: 'Failed to change password.' };
    }
}


export async function saveRole(data: { id?: string, name: string, permissions: any }) {
    const user = await hasPermission('manage_roles');
    if (data.id) {
        await prisma.role.update({ where: { id: data.id }, data: { ...data, permissions: data.permissions.join(',') } });
        await logSecurityEvent({ event: SecurityEvent.ROLE_UPDATED, severity: LogSeverity.WARN, actor: user, details: `Admin updated role '${data.name}' (ID: ${data.id}). Permissions: ${data.permissions.join(',')}`, targetId: data.id, targetType: 'Role' });
    } else {
        const newRole = await prisma.role.create({ data: { ...data, permissions: data.permissions.join(',') } });
        await logSecurityEvent({ event: SecurityEvent.ROLE_CREATED, severity: LogSeverity.WARN, actor: user, details: `Admin created new role '${data.name}'. Permissions: ${data.permissions.join(',')}`, targetId: newRole.id, targetType: 'Role' });
    }
    revalidatePath('/dashboard/admin/roles');
}

export async function deleteRole(roleId: string) {
    const user = await hasPermission('manage_roles');
    const usersInRole = await prisma.user.count({ where: { roleId }});
    if (usersInRole > 0) {
        return { error: 'Cannot delete role. It is currently assigned to one or more users.' };
    }
    await logSecurityEvent({ event: SecurityEvent.ROLE_DELETED, severity: LogSeverity.CRITICAL, actor: user, details: `Admin deleted role with ID: ${roleId}.`, targetId: roleId, targetType: 'Role' });
    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath('/dashboard/admin/roles');
    return { success: true };
}

export async function saveLabel(data: { id?: string, name: string, color: string, type: 'SYSTEM' | 'USER' }) {
    const user = await hasPermission('manage_labels');
    if (data.id) {
        await prisma.label.update({ where: { id: data.id }, data });
        await logSecurityEvent({ event: SecurityEvent.LABEL_UPDATED, severity: LogSeverity.INFO, actor: user, details: `Updated label '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'Label' });
    } else {
        const newLabel = await prisma.label.create({ data });
        await logSecurityEvent({ event: SecurityEvent.LABEL_CREATED, severity: LogSeverity.INFO, actor: user, details: `Created new label '${data.name}'.`, targetId: newLabel.id, targetType: 'Label' });
    }
    revalidatePath('/dashboard/admin/labels');
    return { success: true };
}

export async function deleteLabel(id: string) {
    const user = await hasPermission('manage_labels');
    const label = await prisma.label.findUnique({ where: { id }});
    if (!label) return { error: "Label not found." };
    if (label.type === 'SYSTEM') return { error: "Cannot delete a system label." };
    await logSecurityEvent({ event: SecurityEvent.LABEL_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted label '${label.name}' (ID: ${id}).`, targetId: id, targetType: 'Label' });
    await prisma.label.delete({ where: { id } });
    revalidatePath('/dashboard/admin/labels');
    return { success: true };
}

export async function updateUserProfile(userId: string, data: { name: string, email: string, avatar?: string, signature?: string }) {
    const user = await getLoggedInUser();
    if (!user || (user.id !== userId && !user.actingUser)) {
      throw new Error("Unauthorized");
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
        return { success: false, error: "User not found." };
    }

    // Handle email change request
    if (data.email && currentUser.email !== data.email) {
        const newEmail = data.email;
        const existingUser = await prisma.user.findFirst({ where: { email: newEmail } });
        if (existingUser) {
            return { success: false, error: "Email is already in use by another account." };
        }
        
        const isEmailPendingForOther = await prisma.passwordResetToken.findFirst({
            where: {
                email: { endsWith: `::${newEmail}` },
                NOT: { email: { startsWith: `email-change::${userId}::` } }
            }
        });
        if (isEmailPendingForOther) {
            return { success: false, error: "This email address is pending verification for another account." };
        }
        
        const existingToken = await prisma.passwordResetToken.findFirst({
            where: {
                email: { startsWith: `email-change::${userId}::` }
            }
        });
        if (existingToken) {
            return { success: false, error: "You already have a pending email change request. Please check your email or wait for the previous request to expire." };
        }
        
        const token = randomBytes(32).toString('hex');
        const hashedToken = createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
        const compositeKey = `email-change::${userId}::${newEmail}`;

        await prisma.passwordResetToken.create({
            data: { email: compositeKey, token: hashedToken, expires },
        });

        await logSecurityEvent({ event: SecurityEvent.EMAIL_CHANGE_REQUEST, severity: LogSeverity.WARN, actor: user, details: `User requested email change from ${currentUser.email} to ${newEmail}.`, targetId: userId, targetType: 'User' });
        
        // Send emails without awaiting to make the UI response faster
        sendEmailChangeVerificationEmail({ to: newEmail, name: currentUser.name!, token, userId })
            .catch(error => console.error(`Failed to send email change verification to ${newEmail}:`, error));
            
        sendEmailChangeNotificationEmail({ to: currentUser.email!, name: currentUser.name!, newEmail: newEmail })
            .catch(error => console.error(`Failed to send email change notification to ${currentUser.email!}:`, error));

        // Update other profile data but not the email
        const { email, ...otherData } = data;
        if (Object.keys(otherData).length > 0 || data.name !== currentUser.name) {
             await prisma.user.update({ where: { id: userId }, data: { name: data.name, avatar: data.avatar, signature: data.signature } });
             await logSecurityEvent({ event: SecurityEvent.PROFILE_UPDATED, severity: LogSeverity.INFO, actor: user, details: `User updated their profile (name/avatar/signature).`, targetId: userId, targetType: 'User' });
        }

        return { success: true, message: `Verification email sent to ${newEmail}. Please check your inbox to confirm the change.` };

    } else {
        // No email change, just update other data
        const { email, ...otherData } = data;
        await prisma.user.update({ where: { id: userId }, data: otherData });
        await logSecurityEvent({ event: SecurityEvent.PROFILE_UPDATED, severity: LogSeverity.INFO, actor: user, details: `User updated their profile.`, targetId: userId, targetType: 'User' });
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard');
        return { success: true };
    }
}

export async function verifyEmailChange(token: string): Promise<{ success: boolean; error?: string; message?: string }> {
    if (!token) {
        return { success: false, error: 'Invalid verification token.' };
    }

    const hashedToken = createHash('sha256').update(token).digest('hex');
    const tokenEntry = await prisma.passwordResetToken.findFirst({
        where: {
            token: hashedToken,
            email: { startsWith: 'email-change::' },
            expires: { gt: new Date() }
        }
    });

    if (!tokenEntry) {
        return { success: false, error: "This link is invalid or has expired. Please request a new one." };
    }
    
    const parts = tokenEntry.email.split('::');
    if (parts.length !== 3) {
        await prisma.passwordResetToken.delete({ where: { id: tokenEntry.id } });
        return { success: false, error: "Invalid token format." };
    }
    const userId = parts[1];
    const newEmail = parts[2];
    
    const userToUpdate = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToUpdate) {
        await prisma.passwordResetToken.delete({ where: { id: tokenEntry.id } });
        return { success: false, error: "User not found." };
    }

    const existingUserWithNewEmail = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUserWithNewEmail) {
        await prisma.passwordResetToken.delete({ where: { id: tokenEntry.id } });
        return { success: false, error: "This email address has been registered by another user. Please try a different email." };
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { email: newEmail, tokenVersion: { increment: 1 } } // Increment token to log out other sessions
        }),
        prisma.passwordResetToken.delete({
            where: { id: tokenEntry.id }
        })
    ]);

    await logSecurityEvent({
        event: SecurityEvent.EMAIL_CHANGE_SUCCESS,
        severity: LogSeverity.WARN,
        actor: userToUpdate,
        details: `User email successfully changed from ${userToUpdate.email} to ${newEmail}.`,
        targetId: userId,
        targetType: 'User'
    });
    
    return { success: true, message: `Your email has been successfully updated to ${newEmail}.` };
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
    const user = await hasPermission('manage_users');

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

        try {
            const newUser = await prisma.user.create({
                data: {
                    name, email, roleId, officeId,
                    departmentId: departmentId || null, divisionId: divisionId || null,
                    districtId: districtId || null, branchId: branchId || null,
                    hashedPassword: null, status: 'pending',
                },
            });
            
            const token = randomBytes(32).toString('hex');
            const hashedToken = createHash('sha256').update(token).digest('hex');
            const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

            await prisma.passwordResetToken.upsert({
                where: { email: newUser.email! },
                update: { token: hashedToken, expires },
                create: { email: newUser.email!, token: hashedToken, expires },
            });

            try { await sendVerificationEmail({ to: newUser.email!, name: newUser.name!, token }); } 
            catch (emailError) { console.error(`Failed to send welcome email to ${newUser.email}:`, emailError); }

            existingEmails.add(email);
            result.successCount++;

        } catch (dbError) {
            console.error('DB error during bulk import:', dbError);
            result.errorCount++;
            result.errors.push({ rowIndex, email, error: "Database error." });
        }
    }
    
    await logSecurityEvent({
        event: SecurityEvent.BULK_USER_IMPORT,
        severity: LogSeverity.WARN,
        actor: user,
        details: `Bulk user import action performed. Success: ${result.successCount}, Failures: ${result.errorCount}.`
    });

    revalidatePath('/dashboard/admin/users');
    return result;
}

export async function saveEmailSettings(settings: { notificationsEnabled: boolean, headerText: string, bodyText: string, footerText: string }) {
    const user = await hasPermission('manage_email_settings');
    await prisma.setting.upsert({
        where: { key: 'email' },
        update: { value: settings },
        create: { key: 'email', value: settings }
    });
    await logSecurityEvent({ event: SecurityEvent.SETTINGS_UPDATED, severity: LogSeverity.WARN, actor: user, details: 'Email settings were updated.' });
    revalidatePath('/dashboard/admin/email');
    return { success: true };
}

export async function saveGeneralSettings(settings: { acknowledgementType: AcknowledgementType; referenceFormat: any; acknowledgementMode: 'auto' | 'manual', enableCriticalAlerts: boolean }) {
    const user = await hasPermission('manage_general_settings');
    await prisma.setting.upsert({
        where: { key: 'general' },
        update: { value: settings },
        create: { key: 'general', value: settings }
    });
    await logSecurityEvent({ event: SecurityEvent.SETTINGS_UPDATED, severity: LogSeverity.WARN, actor: user, details: 'General settings were updated.' });
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
    
    await logSecurityEvent({ event: SecurityEvent.BULK_ARCHIVE_ACTION, severity: LogSeverity.WARN, actor: user, details: `Performed bulk action '${action}' on ${memoIds.length} memos.` });

    revalidatePath('/dashboard/admin/archive');
    revalidatePath('/dashboard/inbox');
    return { success: true };
}

export async function archiveMemosOlderThan(archiveDate: Date): Promise<{ success: boolean; error?: string, count?: number }> {
    const user = await hasPermission('manage_archive');

    if (!archiveDate) {
        return { success: false, error: 'A valid date must be provided.' };
    }

    try {
        const memosToArchive = await prisma.memo.findMany({
            where: {
                createdAt: { lt: archiveDate },
                status: { not: 'draft' },
            },
            include: {
                to: { select: { id: true } },
                cc: { select: { id: true } },
                archivedBy: { select: { id: true } },
            },
        });
        
        const updates = memosToArchive.map(memo => {
            const recipientIds = [...new Set([...memo.to.map(u => u.id), ...memo.cc.map(u => u.id)])];
            const alreadyArchivedIds = new Set(memo.archivedBy.map(u => u.id));
            
            const idsToConnect = recipientIds.filter(id => !alreadyArchivedIds.has(id));

            if (idsToConnect.length > 0) {
                return prisma.memo.update({
                    where: { id: memo.id },
                    data: {
                        archivedBy: {
                            connect: idsToConnect.map(id => ({ id }))
                        }
                    }
                });
            }
            return null;
        }).filter(Boolean) as Prisma.Prisma__MemoClient<Memo>[];

        if (updates.length > 0) {
            await prisma.$transaction(updates);
        }

        await logSecurityEvent({
            event: SecurityEvent.BULK_ARCHIVE_ACTION,
            severity: LogSeverity.WARN,
            actor: user,
            details: `Admin bulk archived ${updates.length} memos older than ${archiveDate.toLocaleDateString()}.`
        });

        revalidatePath('/dashboard/admin/archive');
        revalidatePath('/dashboard/archive');
        revalidatePath('/dashboard/inbox');

        return { success: true, count: updates.length };

    } catch (error: any) {
        console.error("Bulk archive failed:", error);
        return { success: false, error: 'An unexpected error occurred during the bulk archive process.' };
    }
}

export async function getMemosToArchiveCount(archiveDate: Date): Promise<number> {
    await hasPermission('manage_archive');

    if (!archiveDate) {
        return 0;
    }

    try {
        const count = await prisma.memo.count({
            where: {
                createdAt: { lt: archiveDate },
                status: { not: 'draft' },
            },
        });
        return count;
    } catch (error) {
        console.error("Failed to get memos to archive count:", error);
        return 0;
    }
}

export async function revokeUserTokens(userId: string) {
    const user = await getLoggedInUser();
    if (!user || (user.id !== userId && !(user.role?.permissions?.includes('manage_users')))) {
        throw new Error("Unauthorized to revoke tokens.");
    }
    
    await prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } }
    });

    await logSecurityEvent({ event: SecurityEvent.LOGOUT, severity: LogSeverity.INFO, actor: user, details: `All sessions for user ID ${userId} were revoked by ${user?.name}.`, targetId: userId, targetType: 'User' });
    
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

export async function getSecurityLogs(page = 1, limit = 15, filters: { severity?: string; query?: string } = {}) {
    await hasPermission('manage_security_logs');
    
    const where: Prisma.SecurityLogWhereInput = {};
    if (filters.severity) where.severity = filters.severity as LogSeverity;
    if (filters.query) {
        where.OR = [
            { event: { contains: filters.query, mode: 'insensitive' } },
            { details: { contains: filters.query, mode: 'insensitive' } },
            { actorId: { contains: filters.query, mode: 'insensitive' } },
            { targetId: { contains: filters.query, mode: 'insensitive' } },
            { ipAddress: { contains: filters.query, mode: 'insensitive' } },
        ];
    }

    const [logs, total] = await prisma.$transaction([
        prisma.securityLog.findMany({ 
            where, 
            skip: (page - 1) * limit, 
            take: limit, 
            orderBy: { timestamp: 'desc' },
            include: { actor: true }
        }),
        prisma.securityLog.count({ where })
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

    const existingDelegation = await prisma.delegation.findFirst({
        where: { delegatorId: user.id, delegateId: data.delegateId },
        include: { delegate: true }
    });

    if (existingDelegation) {
        await prisma.delegation.update({ where: { id: existingDelegation.id }, data: { permissions: data.permissions.join(',') } });
        await logSecurityEvent({ event: SecurityEvent.DELEGATION_UPDATED, severity: LogSeverity.WARN, actor: user, details: `User '${user.name}' updated delegation for '${existingDelegation.delegate.name}'. Permissions: ${data.permissions.join(',')}`, targetId: data.delegateId, targetType: 'User' });
    } else {
        await prisma.delegation.create({ data: { delegatorId: user.id, delegateId: data.delegateId, permissions: data.permissions.join(',') } });
        const delegateUser = await prisma.user.findUnique({where: {id: data.delegateId}});
        await logSecurityEvent({ event: SecurityEvent.DELEGATION_GRANTED, severity: LogSeverity.WARN, actor: user, details: `User '${user.name}' granted delegation to '${delegateUser?.name}'. Permissions: ${data.permissions.join(',')}`, targetId: data.delegateId, targetType: 'User' });
    }
    
    // Invalidate the delegate's sessions to force a re-login and permission refresh
    await revokeUserTokens(data.delegateId);
    
    revalidatePath('/dashboard/profile');
}

export async function removeDelegate(delegationId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const delegation = await prisma.delegation.findUnique({ where: { id: delegationId }, include: { delegate: true } });
    if (!delegation || delegation.delegatorId !== user.id) {
        throw new Error("You are not authorized to remove this delegation.");
    }
    
    await logSecurityEvent({ event: SecurityEvent.DELEGATION_REVOKED, severity: LogSeverity.WARN, actor: user, details: `User '${user.name}' revoked delegation from '${delegation.delegate.name}'.`, targetId: delegation.delegateId, targetType: 'User' });
    
    await prisma.delegation.delete({ where: { id: delegationId } });

    // Invalidate all of the delegate's sessions to prevent unauthorized access
    // if they were in a delegated session when access was revoked.
    await revokeUserTokens(delegation.delegateId);

    revalidatePath('/dashboard/profile');
}


export async function verifyPasswordResetToken(token: string) {
    if (!token) {
        return { error: 'Invalid verification token.' };
    }
    const hashedToken = createHash('sha256').update(token).digest('hex');
    const tokenEntry = await prisma.passwordResetToken.findFirst({
        where: { 
            token: hashedToken,
            expires: { gt: new Date() }
        }
    });

    if (!tokenEntry) {
        return { error: "This link is invalid or has expired. Please request a new one." };
    }

    if (tokenEntry.email.startsWith('email-change::')) {
        return { error: "This is an email verification link, not a password reset link." };
    }

    return { success: true, email: tokenEntry.email };
}

export async function setPasswordWithToken({ token, password }: { token: string, password: string}) {
    if (!token) {
        return { error: "Invalid token provided." };
    }
    const hashedToken = createHash('sha256').update(token).digest('hex');
    
    const tokenEntry = await prisma.passwordResetToken.findFirst({
        where: { token: hashedToken }
    });

    if (!tokenEntry || tokenEntry.expires < new Date()) {
        if (tokenEntry) {
            await prisma.passwordResetToken.delete({ where: { id: tokenEntry.id } });
        }
        return { error: "This link is invalid or has expired. Please request a new one." };
    }
    
    if (tokenEntry.email.startsWith('email-change::')) {
        return { error: "This is an email verification link, not a password reset link." };
    }

    const user = await prisma.user.findUnique({ where: { email: tokenEntry.email }});
    if (!user) {
        await prisma.passwordResetToken.delete({ where: { id: tokenEntry.id } });
        return { error: "This link is invalid or has expired. Please request a new one." };
    }
    
    const validation = await passwordSchema.safeParseAsync(password);
    if (!validation.success) {
        // Invalidate the token on failed password policy to prevent brute-force
        await prisma.passwordResetToken.delete({ where: { id: tokenEntry.id } });
        const errorMessage = validation.error.issues.map(i => i.message).join(' ');
        return { error: `${errorMessage} For security, this link has been invalidated. Please request a new one.` };
    }

    const newHashedPassword = await bcrypt.hash(password, 10);
    
    try {
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: {
                    hashedPassword: newHashedPassword,
                    status: 'active',
                    onboardingCompleted: true,
                    tokenVersion: { increment: 1 }
                }
            }),
            prisma.passwordResetToken.delete({
                where: { id: tokenEntry.id }
            })
        ]);

        await logSecurityEvent({ event: SecurityEvent.PASSWORD_RESET_SUCCESS, severity: LogSeverity.INFO, actor: user, details: `User '${user.name}' successfully set their password via reset link.`, targetId: user.id, targetType: 'User' });
        return { success: true };
    } catch(error) {
        console.error("Error in setPasswordWithToken transaction:", error);
        return { error: "An unexpected server error occurred. Please try again." };
    }
}
