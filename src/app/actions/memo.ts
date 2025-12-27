
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Memo, User } from '@/lib/types';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { sendEmail } from '@/lib/email';
import WebSocket from 'ws';

const memoSchema = z.object({
  to: z.array(z.string()).min(1, 'Please select at least one recipient.'),
  cc: z.array(z.string()).optional(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
  attachments: z.array(z.any()).optional(),
  replyTo: z.string().optional(),
});

// Function to send data to WebSocket server via HTTP
async function sendToWebSocket(data: any) {
    try {
        await fetch('http://localhost:8080/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
    } catch (error) {
        console.error('Failed to send message to WebSocket server:', error);
    }
}

export async function getDashboardData(tab: string, query: string, status: string, dateRange: { from?: string, to?: string}) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    if (user.mustChangePassword) {
      // If user must change password, they should only see the change password page.
      // Returning an empty array for dashboard data prevents any other data from loading.
      return [];
    }

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
            from: { include: { role: true } },
            to: { include: { role: true } },
            cc: { include: { role: true } },
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
      from: { include: { role: true } },
      to: { include: { role: true } },
      cc: { include: { role: true } },
      attachments: true,
      activity: { include: { actor: true }, orderBy: { timestamp: 'desc' } },
      current_holder: { include: { role: true } },
      previous_holders: { include: { role: true } },
      acknowledgedBy: { include: { role: true } },
      archivedBy: { include: { role: true } },
      replies: { include: { role: true } },
      replyTo: { include: { role: true } }
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
        revalidatePath('/dashboard/inbox');
    }
}

export async function markAllAsReadForUser() {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    // Find all memos in the user's inbox that are unread by them
    const unreadMemos = await prisma.memo.findMany({
        where: {
            AND: [
                // Is in inbox
                {
                    status: { not: 'draft' },
                    OR: [
                        { to: { some: { id: user.id } } },
                        { cc: { some: { id: user.id } } },
                        { current_holderId: user.id },
                    ],
                },
                // Is not archived by the user
                { NOT: { archivedBy: { some: { id: user.id } } } },
                // Is not already viewed or acknowledged by the user
                {
                    NOT: {
                        activity: {
                            some: {
                                actorId: user.id,
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

    // Create 'viewed' activity for each unread memo
    await prisma.activity.createMany({
        data: unreadMemos.map(memo => ({
            memoId: memo.id,
            actorId: user.id,
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

    const memo = await prisma.memo.findUnique({
        where: { id: memoId },
        include: { activity: { where: { actorId: user.id, action: 'viewed' } } }
    });

    if (!memo) throw new Error("Memo not found");

    // Only mark as read, never as unread.
    if (memo.activity.length === 0) {
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
    }
    revalidatePath('/dashboard/inbox');
    revalidatePath(`/dashboard?id=${memoId}`);
    return getDashboardData('inbox', '', '', {});
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
        },
        include: {
            from: { include: { role: true } },
            to: { include: { role: true } },
            cc: { include: { role: true } },
            attachments: true,
            activity: {
                include: { actor: true }
            },
            current_holder: { include: { role: true } },
            previous_holders: { include: { role: true } },
            acknowledgedBy: { include: { role: true } },
            archivedBy: { include: { role: true } },
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

    // Send to WebSocket server
    await sendToWebSocket({
        type: 'new-memo',
        payload: newMemo,
    });

    // Send email notifications
    const allRecipients = [...newMemo.to, ...newMemo.cc];
    for (const recipient of allRecipients) {
        const isDirectRecipient = newMemo.to.some(u => u.id === recipient.id);
        try {
            await sendEmail({
                to: recipient.email,
                subject: `New Memo: ${newMemo.subject}`,
                memo: newMemo,
                sender: user,
                type: isDirectRecipient ? 'direct' : 'cc'
            });
        } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
        }
    }


    revalidatePath('/dashboard/inbox');
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
         const existingDraft = await prisma.memo.findUnique({
            where: { id: draftId },
            include: { to: true, cc: true },
        });

        const toIds = data.to.map(u => u.id);
        const ccIds = data.cc.map(u => u.id);

        const toToDisconnect = existingDraft?.to.filter(u => !toIds.includes(u.id)) || [];
        const ccToDisconnect = existingDraft?.cc.filter(u => !ccIds.includes(u.id)) || [];
        
        const payload = {
            fromId: user.id,
            subject: data.subject || '',
            body: data.body || '',
            to: {
                disconnect: toToDisconnect.map(u => ({ id: u.id })),
                connect: toIds.map(id => ({ id })),
            },
            cc: {
                disconnect: ccToDisconnect.map(u => ({ id: u.id })),
                connect: ccIds.map(id => ({ id })),
            },
            attachments: {
                deleteMany: {},
                ...attachmentsData,
            },
            status: 'draft' as const,
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
            memo_reference_number: `DRAFT-${Date.now()}`,
            replyToId: data.replyTo,
        };
        const newDraft = await prisma.memo.create({ data: payload });
        return newDraft;
    }
}


export async function deleteDraft(draftId: string) {
    await prisma.memo.delete({ where: { id: draftId }});
    revalidatePath('/dashboard/drafts');
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

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard?id=${memoId}`);
}

export async function forwardMemo(memoId: string, forwardToIds: string[], remark: string) {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");
  
    const memo = await getMemo(memoId);
    if (!memo) return { error: 'Memo not found.' };
  
    const forwardToUsers = await prisma.user.findMany({
      where: { id: { in: forwardToIds } },
    });
    
    if (forwardToUsers.length !== forwardToIds.length) {
      return { error: 'One or more users to forward to were not found.' };
    }
  
    // For simplicity in this app, we'll assign the *first* recipient as the new current holder.
    // In a more complex scenario, you might have parallel holders or a different logic.
    const newCurrentHolderId = forwardToUsers[0].id;
    const previousHolderId = memo.current_holderId;
  
    // Add all forwarded users to the 'to' list if they are not already there.
    const existingToIds = new Set(memo.to.map(u => u.id));
    const usersToConnect = forwardToUsers.filter(u => !existingToIds.has(u.id));
  
    // Create activity logs for each forwarded user.
    const activityCreates = forwardToUsers.map(forwardToUser => ({
      actorId: user.id,
      action: 'forwarded' as const,
      details: `Forwarded from ${user.name} to ${forwardToUser.name}.${remark ? `\n<b>Remark:</b> ${remark}` : ''}`,
    }));
  
    await prisma.memo.update({
      where: { id: memoId },
      data: {
        current_holderId: newCurrentHolderId,
        previous_holders: { 
            connect: previousHolderId ? { id: previousHolderId } : undefined
        },
        to: {
          connect: usersToConnect.map(u => ({ id: u.id }))
        },
        activity: {
          create: activityCreates,
        },
      },
    });
  
    revalidatePath('/dashboard/inbox');
    revalidatePath(`/dashboard?id=${memoId}`);
    return { success: true };
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

  revalidatePath('/dashboard/inbox');
  revalidatePath(`/dashboard?id=${memoId}`);
}


export async function getUsers() {
    return await prisma.user.findMany({
        include: {
            role: true,
            office: {
                include: {
                    departments: true,
                    districts: true,
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
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
    return await prisma.office.findMany();
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
                    departments: {
                        include: {
                            divisions: true,
                        },
                    },
                    districts: {
                        include: {
                            branches: true,
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
export async function saveDivision(data: { id?: string, name: string, code: string, departmentId: string }) {
    if (data.id) {
        await prisma.division.update({ where: { id: data.id }, data });
    } else {
        await prisma.division.create({ data });
    }
    revalidatePath('/dashboard/admin/divisions');
}

export async function deleteDivision(id: string) {
    const users = await prisma.user.count({ where: { officeId: id }});
    if (users > 0) {
        return { error: 'Cannot delete division. It has associated users. Please reassign them first.' };
    }

    await prisma.division.delete({ where: { id } });
    await prisma.office.delete({ where: { id } });
    revalidatePath('/dashboard/admin/divisions');
    return { success: true };
}


export async function saveDepartment(data: { id?: string, name: string, code: string, officeId: string }) {
    if (data.id) {
        await prisma.department.update({ where: { id: data.id }, data });
    } else {
        await prisma.department.create({ data });
    }
    revalidatePath('/dashboard/admin/departments');
}

export async function deleteDepartment(id: string) {
    const divisions = await prisma.division.count({ where: { departmentId: id } });
    if (divisions > 0) {
        return { error: 'Cannot delete department. It has associated divisions. Please delete them first.' };
    }
    await prisma.department.delete({ where: { id } });
    revalidatePath('/dashboard/admin/departments');
    return { success: true };
}

export async function saveBranch(data: { id?: string, name: string, code: string, districtId: string }) {
    if (data.id) {
        await prisma.branch.update({ where: { id: data.id }, data });
    } else {
        await prisma.branch.create({ data });
    }
    revalidatePath('/dashboard/admin/branches');
}

export async function deleteBranch(id: string) {
    const users = await prisma.user.count({ where: { officeId: id }});
    if (users > 0) {
        return { error: 'Cannot delete branch. It has associated users. Please reassign them first.' };
    }
    await prisma.branch.delete({ where: { id } });
    await prisma.office.delete({ where: { id } });
    revalidatePath('/dashboard/admin/branches');
    return { success: true };
}

export async function saveDistrict(data: { id?: string, name: string, code: string, officeId: string }) {
    if (data.id) {
        await prisma.district.update({ where: { id: data.id }, data });
    } else {
        await prisma.district.create({ data });
    }
    revalidatePath('/dashboard/admin/districts');
}

export async function deleteDistrict(id: string) {
    const branches = await prisma.branch.count({ where: { districtId: id } });
    if (branches > 0) {
        return { error: 'Cannot delete district. It has associated branches. Please delete them first.' };
    }
    await prisma.district.delete({ where: { id } });
    revalidatePath('/dashboard/admin/districts');
    return { success: true };
}

export async function saveOffice(data: { id?: string, name: string, code: string, type: 'division' | 'branch' }) {
    if (data.id) {
        await prisma.office.update({ where: { id: data.id }, data });
    } else {
        await prisma.office.create({ data });
    }
    revalidatePath('/dashboard/admin/offices');
}

export async function deleteOffice(id: string) {
    const districts = await prisma.district.count({ where: { officeId: id } });
    if (districts > 0) {
        return { error: 'Cannot delete office. It has associated districts. Please delete them first.' };
    }
    
    const departments = await prisma.department.count({ where: { officeId: id } });
    if (departments > 0) {
        return { error: 'Cannot delete office. It has associated departments. Please delete them first.' };
    }

    await prisma.office.delete({ where: { id } });
    revalidatePath('/dashboard/admin/offices');
    return { success: true };
}


export async function saveUser(data: { id?: string, name: string, email: string, officeId: string, roleId: string, password?: string, status?: string }) {
    const payload: any = {
        name: data.name,
        email: data.email,
        officeId: data.officeId,
        roleId: data.roleId,
        status: data.status ?? 'active',
    };

    if (data.password) {
        payload.hashedPassword = await bcrypt.hash(data.password, 10);
        payload.mustChangePassword = true;
    }
    
    if (data.id) {
        await prisma.user.update({ where: { id: data.id }, data: payload });
    } else {
        payload.mustChangePassword = true;
        await prisma.user.create({ data: payload });
    }
    revalidatePath('/dashboard/admin/users');
}

export async function deleteUser(userId: string) {
    // Safety check: prevent deleting a user who has authored memos.
    // In a real-world scenario, you might want to reassign memos or soft-delete the user.
    const memoCount = await prisma.memo.count({ where: { fromId: userId } });
    if (memoCount > 0) {
        return { error: `Cannot delete user. They are the author of ${memoCount} memo(s). Please reassign them first.` };
    }
    // Add more checks for other relations if necessary.
    
    // Perform deletion
    try {
        await prisma.user.delete({ where: { id: userId }});
        revalidatePath('/dashboard/admin/users');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: 'An unexpected error occurred while deleting the user.' };
    }
}


export async function resetUserPassword(userId: string, newPassword?: string) {
    try {
        const password = newPassword || (Math.random().toString(36).slice(-8) + 'A1!');
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { 
                hashedPassword,
                mustChangePassword: true,
            }
        });
        revalidatePath('/dashboard/admin/users');
        return { success: true, newPassword: password };
    } catch (error) {
        return { success: false, error: 'Failed to reset password.' };
    }
}

export async function changeUserPassword(password: string) {
    try {
        const user = await getLoggedInUser();
        if (!user) return { success: false, error: 'Not authenticated.' };

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                hashedPassword,
                mustChangePassword: false
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

let emailSettings = { 
    notificationsEnabled: true, 
    headerText: 'New Memo Notification', 
    bodyText: 'Hello,\n\n{{notificationType}}\n\nPlease find the details of the memo below.',
    footerText: 'This is an automated message. Please do not reply.' 
};

export async function getEmailSettings() {
    return emailSettings;
}

export async function saveEmailSettings(settings: { notificationsEnabled: boolean, headerText: string, bodyText: string, footerText: string }) {
    emailSettings = settings;
    revalidatePath('/dashboard/admin/email');
    return { success: true };
}


// END SIMULATED SETTINGS

export async function performBulkArchiveActions(action: 'archive' | 'restore' | 'delete', memoIds: string[]) {
    if (memoIds.length === 0) return { error: 'No memos selected.' };

    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");

    if (action === 'delete') {
        // This is a hard delete. Ensure compliance with data retention policies.
        // In a real app, you might want to soft-delete or log this action extensively.
        await prisma.attachment.deleteMany({ where: { memoId: { in: memoIds } } });
        await prisma.activity.deleteMany({ where: { memoId: { in: memoIds } } });

        // Need to handle replies carefully. Find memos that reply to the ones being deleted.
        await prisma.memo.updateMany({
            where: { replyToId: { in: memoIds } },
            data: { replyToId: null },
        });

        await prisma.memo.deleteMany({
            where: { id: { in: memoIds } },
        });

    } else if (action === 'restore') {
        // For restore, we need to disconnect for all users who archived it.
        // This is a bit tricky with the current schema. A better approach might be a separate Archive model.
        // For now, we find all users who archived any of the selected memos and disconnect them.
        const memosToRestore = await prisma.memo.findMany({
            where: { id: { in: memoIds } },
            select: { id: true, archivedBy: { select: { id: true } } }
        });
        
        for (const memo of memosToRestore) {
            await prisma.memo.update({
                where: { id: memo.id },
                data: {
                    archivedBy: {
                        disconnect: memo.archivedBy.map(u => ({ id: u.id }))
                    }
                }
            });
        }
    }
    
    revalidatePath('/dashboard/admin/archive');
    revalidatePath('/dashboard/inbox');
    return { success: true };
}
