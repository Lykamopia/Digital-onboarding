
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Memo, User } from '@/lib/types';
import { z } from 'zod';

const memoSchema = z.object({
  to: z.array(z.string()).min(1, 'Please select at least one recipient.'),
  cc: z.array(z.string()).optional(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
  attachments: z.array(z.any()).optional(),
  replyTo: z.string().optional(),
});

export async function getDashboardData(tab: string, query: string, status: string, dateRange: { from?: string, to?: string}) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const where: any = {
        AND: []
    };

    const isArchivedByCurrentUser = { archivedBy: { some: { id: user.id } } };

    if (tab === 'archive') {
        where.AND.push(isArchivedByCurrentUser);
    } else {
        where.AND.push({ NOT: isArchivedByCurrentUser });
        if (tab === 'inbox') {
            where.AND.push({
                status: { not: 'draft' } ,
                OR: [
                    { to: { some: { id: user.id } } },
                    { cc: { some: { id: user.id } } },
                    { current_holderId: user.id },
                ],
            });
        } else if (tab === 'sent') {
            where.AND.push({ fromId: user.id, status: { not: 'draft' } });
        } else if (tab === 'drafts') {
            where.AND.push({ fromId: user.id, status: 'draft' });
        }
    }
    
    if (query) {
        where.AND.push({
             OR: [
                { subject: { contains: query, mode: 'insensitive' } },
                { memo_reference_number: { contains: query, mode: 'insensitive' } },
                { from: { name: { contains: query, mode: 'insensitive' } } },
                { to: { some: { name: { contains: query, mode: 'insensitive' } } } },
            ]
        })
    }

    if (tab === 'inbox' && status && status !== 'all') {
      const userHasAcknowledged = { acknowledgedBy: { some: { id: user.id } } };
      const userHasViewed = { activity: { some: { action: 'viewed', actorId: user.id } } };

      switch (status) {
        case 'read':
          where.AND.push({
            OR: [userHasViewed, userHasAcknowledged]
          });
          break;
        case 'unread':
          where.AND.push({
            NOT: {
              OR: [userHasViewed, userHasAcknowledged]
            }
          });
          break;
        case 'acknowledged':
          where.AND.push(userHasAcknowledged);
          break;
      }
    }


    if (dateRange?.from) {
        where.AND.push({ createdAt: { gte: new Date(dateRange.from) } });
    }
    if (dateRange?.to) {
        where.AND.push({ createdAt: { lte: new Date(dateRange.to) } });
    }
    
    const memos = await prisma.memo.findMany({
        where,
        include: {
            from: true,
            to: true,
            cc: true,
            attachments: true,
            activity: {
                include: {
                    actor: true
                }
            },
            current_holder: true,
            previous_holders: true,
            acknowledgedBy: true,
            archivedBy: true,
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
    return memos;
}


export async function getMemo(id: string) {
  if (!id) return null;
  const memo = await prisma.memo.findUnique({
    where: { id },
    include: {
      from: true,
      to: true,
      cc: true,
      attachments: true,
      activity: { include: { actor: true }, orderBy: { timestamp: 'desc' } },
      current_holder: true,
      previous_holders: true,
      acknowledgedBy: true,
      archivedBy: true,
    },
  });
  return memo;
}


export async function markAsRead(memoId: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const memo = await prisma.memo.findUnique({
        where: { id: memoId },
        include: { activity: true }
    });

    if (memo && !memo.activity.some(a => a.actorId === user.id && a.action === 'viewed')) {
        await prisma.memo.update({
            where: { id: memoId },
            data: {
                activity: {
                    create: {
                        actorId: user.id,
                        action: 'viewed',
                    }
                }
            }
        });
        revalidatePath('/dashboard');
    }
}

export async function sendMemo(formData: FormData) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const to = formData.getAll('to[]') as string[];
    const cc = formData.getAll('cc[]') as string[];

    const data = {
        to,
        cc,
        subject: formData.get('subject') as string,
        body: formData.get('body') as string,
        attachments: JSON.parse(formData.get('attachments') as string || '[]'),
        replyTo: formData.get('replyTo') as string || undefined,
    };
    
    const validation = memoSchema.safeParse(data);
    if (!validation.success) {
        console.error(validation.error.flatten().fieldErrors);
        return { error: 'Invalid memo data', details: validation.error.flatten().fieldErrors };
    }
    
    const validatedData = validation.data;

    const memoCount = await prisma.memo.count({ where: { status: { not: 'draft' } } });

    const newMemo = await prisma.memo.create({
        data: {
            memo_reference_number: `MEMO-${new Date().getFullYear()}-${String(memoCount + 1).padStart(3, '0')}`,
            fromId: user.id,
            to: { connect: validatedData.to.map(id => ({ id })) },
            cc: { connect: validatedData.cc?.map(id => ({ id })) },
            current_holderId: validatedData.to[0],
            subject: validatedData.subject,
            body: validatedData.body,
            status: 'sent',
            attachments: {
                create: validatedData.attachments.map((att: any) => ({
                    name: att.name,
                    type: att.type,
                    size: att.size,
                    url: att.url,
                }))
            },
            activity: {
                create: [
                    { actorId: user.id, action: 'sent', details: `Sent to recipients.` }
                ]
            },
            replyToId: validatedData.replyTo,
        }
    });

    if (validatedData.replyTo) {
        await prisma.memo.update({
            where: { id: validatedData.replyTo },
            data: {
                activity: {
                    create: {
                        actorId: user.id,
                        action: 'replied',
                        details: `Replied to this memo. See memo ${newMemo.memo_reference_number}`
                    }
                }
            }
        });
    }

    const draftId = formData.get('draftId') as string;
    if (draftId) {
        await prisma.memo.delete({ where: { id: draftId } });
    }

    revalidatePath('/dashboard');
    return { success: true, memo: newMemo };
}

export async function saveDraft(data: Partial<Memo> & { to: User[], cc: User[] }, draftId?: string | null) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    const attachmentsData = {
        create: (data.attachments || []).map((att: any) => ({
            name: att.name,
            type: att.type,
            size: att.size,
            url: att.url,
        })),
    };

    if (draftId) {
        const payload = {
            fromId: user.id,
            subject: data.subject || '',
            body: data.body || '',
            to: { set: data.to.map(u => ({ id: u.id })) },
            cc: { set: data.cc.map(u => ({ id: u.id })) },
            attachments: {
                deleteMany: {}, // Clear existing attachments
                ...attachmentsData
            },
            status: 'draft' as const,
            memo_reference_number: 'DRAFT',
            replyToId: data.replyTo,
        };
        const updatedDraft = await prisma.memo.update({
            where: { id: draftId },
            data: payload,
        });
        return updatedDraft;
    } else {
        const payload = {
            fromId: user.id,
            subject: data.subject || '',
            body: data.body || '',
            to: { connect: data.to.map(u => ({ id: u.id })) },
            cc: { connect: data.cc.map(u => ({ id: u.id })) },
            attachments: attachmentsData,
            status: 'draft' as const,
            memo_reference_number: 'DRAFT',
            replyToId: data.replyTo,
        };
        const newDraft = await prisma.memo.create({ data: payload });
        return newDraft;
    }
}


export async function deleteDraft(draftId: string) {
    await prisma.memo.delete({ where: { id: draftId }});
    revalidatePath('/dashboard');
    return { success: true };
}

export async function acknowledgeMemo(memoId: string) {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Not authenticated");

  const memo = await getMemo(memoId);
  if (!memo) return;

  await prisma.memo.update({
    where: { id: memoId },
    data: {
      acknowledgedBy: { connect: { id: user.id } },
      activity: {
        create: {
          actorId: user.id,
          action: 'acknowledged',
          details: 'Acknowledged receipt of the memo.',
        },
      },
    },
  });

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard?id=${memoId}`);
}

export async function forwardMemo(memoId: string, forwardToId: string, remark: string) {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Not authenticated");

  const memo = await getMemo(memoId);
  const forwardToUser = await prisma.user.findUnique({ where: { id: forwardToId }});
  
  if (!memo || !forwardToUser) return;

  await prisma.memo.update({
    where: { id: memoId },
    data: {
      current_holderId: forwardToId,
      previous_holders: { connect: { id: memo.current_holderId! } },
      activity: {
        create: {
          actorId: user.id,
          action: 'forwarded',
          details: `Forwarded from ${user.name} to ${forwardToUser.name}.${remark ? `\n<b>Remark:</b> ${remark}` : ''}`,
        },
      },
    },
  });

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard?id=${memoId}`);
}


export async function archiveMemo(memoId: string, archive: boolean) {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Not authenticated");

  const data = archive ? 
    { archivedBy: { connect: { id: user.id } } } :
    { archivedBy: { disconnect: { id: user.id } } };
    
  await prisma.memo.update({
      where: { id: memoId },
      data: {
          ...data,
          activity: {
            create: {
                actorId: user.id,
                action: archive ? 'archived' : 'unarchived',
                details: archive ? 'Archived the memo.' : 'Unarchived the memo.',
            }
        }
      }
  });

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard?id=${memoId}`);
}


export async function getUsers() {
    return await prisma.user.findMany({
        include: {
            role: true,
            office: {
                include: {
                    department: {
                        include: {
                            division: true,
                        },
                    },
                },
            },
        },
    });
}

export async function getAllMemosForAdmin() {
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
    return await prisma.division.findMany();
}
export async function getDepartments() {
    return await prisma.department.findMany({ include: { division: true } });
}
export async function getOffices() {
    return await prisma.office.findMany({ include: { department: { include: { division: true } } } });
}
export async function getRoles() {
    return await prisma.role.findMany();
}

export async function getLoggedInUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return null;
    }

    const user = await prisma.user.findUnique({ 
        where: { email: session.user.email },
        include: { 
            role: true,
            office: {
                include: {
                    department: {
                        include: {
                            division: true
                        }
                    }
                }
            }
        }
    });
    if (!user) return null;
    return user;
}


// Admin actions
export async function saveDivision(data: { id?: string, name: string, code: string }) {
    if (data.id) {
        await prisma.division.update({ where: { id: data.id }, data });
    } else {
        await prisma.division.create({ data });
    }
    revalidatePath('/dashboard/admin/divisions');
}

export async function saveDepartment(data: { id?: string, name: string, code: string, divisionId: string }) {
    if (data.id) {
        await prisma.department.update({ where: { id: data.id }, data });
    } else {
        await prisma.department.create({ data });
    }
    revalidatePath('/dashboard/admin/departments');
}

export async function saveOffice(data: { id?: string, name: string, code: string, departmentId: string }) {
    if (data.id) {
        await prisma.office.update({ where: { id: data.id }, data });
    } else {
        await prisma.office.create({ data });
    }
    revalidatePath('/dashboard/admin/offices');
}

export async function saveUser(data: { id?: string, name: string, email: string, officeId: string, roleId: string }) {
    if (data.id) {
        await prisma.user.update({ where: { id: data.id }, data: { name: data.name, email: data.email, officeId: data.officeId, roleId: data.roleId } });
    } else {
        await prisma.user.create({ data });
    }
    revalidatePath('/dashboard/admin/users');
}

export async function saveRole(data: { id?: string, name: string, permissions: any }) {
     if (data.id) {
        await prisma.role.update({ where: { id: data.id }, data });
    } else {
        await prisma.role.create({ data });
    }
    revalidatePath('/dashboard/admin/roles');
}

export async function deleteRole(roleId: string) {
    const usersInRole = await prisma.user.count({ where: { roleId }});
    if (usersInRole > 0) {
        return { error: 'Cannot delete role. It is currently assigned to one or more users.' };
    }
    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath('/dashboard/admin/roles');
    return { success: true };
}

export async function updateUserProfile(userId: string, data: { name: string, email: string, avatar?: string }) {
    await prisma.user.update({
        where: { id: userId },
        data: data
    });
    revalidatePath('/dashboard/profile');
    return { success: true };
}

// SIMULATED SETTINGS - in a real app, this would be a separate `Settings` table
let archiveSettings = { autoArchiveDays: 90 };
export async function getArchiveSettings() {
    // Simulate fetching from DB
    return archiveSettings;
}
export async function saveArchiveSettings(days: number) {
    // Simulate saving to DB
    archiveSettings.autoArchiveDays = days;
    // Here you might trigger a background job to enforce the new rule
    console.log(`Auto-archive period set to ${days} days.`);
    revalidatePath('/dashboard/admin/archive');
    return { success: true };
}
// END SIMULATED SETTINGS

export async function performBulkArchiveActions(action: 'archive' | 'restore' | 'delete', memoIds: string[]) {
    if (memoIds.length === 0) return { error: 'No memos selected.' };

    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    if (action === 'delete') {
        await prisma.memo.deleteMany({
            where: { id: { in: memoIds } },
        });
    } else {
        const connectOrDisconnect = action === 'archive' ? 'connect' : 'disconnect';
        
        await prisma.user.update({
            where: { id: user.id },
            data: {
                archivedMemos: {
                    [connectOrDisconnect]: memoIds.map(id => ({ id })),
                }
            }
        });
    }
    
    revalidatePath('/dashboard/admin/archive');
    revalidatePath('/dashboard');
    return { success: true };
}
