'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import type { User, Permission, Role, Office, LoggedInUser, BulkImportResult, Department, Division, District, Branch } from '@/lib/types';
import { LogSeverity } from '@/lib/types';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getGeneralSettings } from './settings';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUTH & UTILS – essential for the platform
// ─────────────────────────────────────────────────────────────────────────────

async function hasPermission(permission: Permission | Permission[]): Promise<LoggedInUser> {
    const user = await getLoggedInUser();
    if (!user) {
        throw new Error("Not authenticated");
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

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

export async function getLoggedInUser(): Promise<LoggedInUser | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return null;
    }
    const sessionUser = session.user as any;

    const currentUserId = sessionUser.id;

    const userInclude = {
        role: true,
        office: true,
        department: true,
        division: true,
        district: true,
        branch: true,
    };

    const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId || '' },
        include: userInclude
    });

    if (!currentUser) return null;
    
    (currentUser as any).hashedPassword = null;

    if (currentUser.status === 'inactive') {
        return null;
    }

    const finalUser: LoggedInUser = {
        ...currentUser as any,
        onboardingCompleted: currentUser.onboardingCompleted,
    };
    
    if (sessionUser.isDelegated) {
        finalUser.actingUser = sessionUser.realUser;
    }

    return finalUser;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ACTIONS – structure, users, roles (Rebranded for Onboarding)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserLockoutStatus(email: string) {
    if (!email) return null;
    const user = await prisma.user.findUnique({
        where: { email },
        select: { lockoutUntil: true }
    });
    return user;
}

export async function saveDivision(data: { id?: string, name: string, code: string, departmentId: string }) {
    const user = await hasPermission('admin');
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
    const user = await hasPermission('admin');
    try {
        const division = await prisma.division.findUnique({ where: { id } });
        await prisma.division.delete({ where: { id } });
        if (division) {
            await logSecurityEvent({ event: SecurityEvent.DIVISION_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted division '${division.name}' (ID: ${id}).`, targetId: id, targetType: 'Division' });
        }
        revalidatePath('/dashboard/admin/divisions');
        return { success: true };
    } catch (error: any) {
        return { error: 'An error occurred while deleting division.' };
    }
}

export async function saveDepartment(data: { id?: string, name: string, code: string, officeId: string }) {
    const user = await hasPermission('admin');
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
    const user = await hasPermission('admin');
    try {
        const department = await prisma.department.findUnique({ where: { id } });
        await prisma.department.delete({ where: { id } });
        if (department) {
            await logSecurityEvent({ event: SecurityEvent.DEPARTMENT_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted department '${department.name}' (ID: ${id}).`, targetId: id, targetType: 'Department' });
        }
        revalidatePath('/dashboard/admin/departments');
        return { success: true };
    } catch (error: any) {
        return { error: 'An error occurred.' };
    }
}

export async function saveBranch(data: { id?: string, name: string, code: string, districtId: string }) {
    const user = await hasPermission('admin');
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
    const user = await hasPermission('admin');
    try {
        const branch = await prisma.branch.findUnique({ where: { id } });
        await prisma.branch.delete({ where: { id } });
        if(branch) {
            await logSecurityEvent({ event: SecurityEvent.BRANCH_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted branch '${branch.name}' (ID: ${id}).`, targetId: id, targetType: 'Branch' });
        }
        revalidatePath('/dashboard/admin/branches');
        return { success: true };
    } catch (error: any) {
        return { error: 'An error occurred.' };
    }
}

export async function saveDistrict(data: { id?: string, name: string, code: string, officeId: string }) {
    const user = await hasPermission('admin');
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
    const user = await hasPermission('admin');
    try {
        const district = await prisma.district.findUnique({ where: { id } });
        await prisma.district.delete({ where: { id } });
        if (district) {
            await logSecurityEvent({ event: SecurityEvent.DISTRICT_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted district '${district.name}' (ID: ${id}).`, targetId: id, targetType: 'District' });
        }
        revalidatePath('/dashboard/admin/districts');
        return { success: true };
    } catch (error: any) {
        return { error: 'An error occurred.' };
    }
}

export async function saveOffice(data: { id?: string, name: string, code: string, type?: 'division_office' | 'branch_office' | 'head_office' }) {
    const user = await hasPermission('admin');
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
    const user = await hasPermission('admin');
    try {
        const office = await prisma.office.findUnique({ where: { id } });
        await prisma.office.delete({ where: { id } });
        if (office) {
            await logSecurityEvent({ event: SecurityEvent.OFFICE_DELETED, severity: LogSeverity.WARN, actor: user, details: `Deleted office '${office.name}' (ID: ${id}).`, targetId: id, targetType: 'Office' });
        }
        revalidatePath('/dashboard/admin/offices');
        return { success: true };
    } catch (error: any) {
        return { error: 'An error occurred.' };
    }
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
}): Promise<{ success: boolean; error?: string; message?: string; }> {
    const adminUser = await hasPermission('manage_users');
    
    if (!data.id) {
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
        if (existingUser) {
            return { success: false, error: `A user with the email ${data.email} already exists.` };
        }

        const newUserPayload: any = {
            name: data.name,
            email: data.email,
            roleId: data.roleId,
            status: 'pending',
            officeId: data.officeId || null,
            departmentId: data.departmentId || null,
            divisionId: data.divisionId || null,
            districtId: data.districtId || null,
            branchId: data.branchId || null,
            hashedPassword: null,
            onboardingCompleted: false,
        };
        
        const newUser = await prisma.user.create({ data: newUserPayload });
        await logSecurityEvent({ event: SecurityEvent.USER_CREATED, severity: LogSeverity.WARN, actor: adminUser, details: `Admin created new user '${newUser.name}' (ID: ${newUser.id}).`, targetId: newUser.id, targetType: 'User' });

        const token = require('crypto').randomBytes(32).toString('hex');
        const hashedToken = require('crypto').createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.passwordResetToken.upsert({
            where: { email: newUser.email! },
            update: { token: hashedToken, expires },
            create: { email: newUser.email!, token: hashedToken, expires },
        });
        
        const { sendVerificationEmail } = require('@/lib/email');
        sendVerificationEmail({ to: newUser.email!, name: newUser.name!, token: token })
            .catch((error: any) => console.error(`Failed to send welcome email:`, error));
        
        revalidatePath('/dashboard/admin/users');
        return { success: true };
    }

    const existingUser = await prisma.user.findUnique({ where: { id: data.id } });
    if (!existingUser) return { success: false, error: 'User not found.' };
    
    const payload: any = {
        name: data.name,
        roleId: data.roleId,
        status: data.status,
        email: data.email,
        officeId: data.officeId || null,
        departmentId: data.departmentId || null,
        divisionId: data.divisionId || null,
        districtId: data.districtId || null,
        branchId: data.branchId || null,
    };
    
    await prisma.user.update({ where: { id: data.id }, data: payload });
    await logSecurityEvent({ event: SecurityEvent.USER_UPDATED, severity: LogSeverity.INFO, actor: adminUser, details: `Admin updated user profile for '${data.name}' (ID: ${data.id}).`, targetId: data.id, targetType: 'User' });
    
    revalidatePath('/dashboard/admin/users');
    return { success: true };
}

export async function deleteUser(userId: string) {
    const user = await hasPermission('manage_users');
    try {
        const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
        await prisma.user.delete({ where: { id: userId }});
        if (userToDelete) {
            await logSecurityEvent({ event: SecurityEvent.USER_DELETED, severity: LogSeverity.CRITICAL, actor: user, details: `Admin deleted user '${userToDelete.name}' (ID: ${userId}).`, targetId: userId, targetType: 'User' });
        }
        revalidatePath('/dashboard/admin/users');
        return { success: true };
    } catch (error: any) {
        return { error: 'Failed to delete user.' };
    }
}

export async function getAdminUsers(page = 1, limit = 10, filters: any = {}) {
    await hasPermission('manage_users');

    const where: any = { AND: [] };
    if (filters.query) {
        where.AND.push({
            OR: [
                { name: { contains: filters.query, mode: 'insensitive' } },
                { email: { contains: filters.query, mode: 'insensitive' } },
            ]
        });
    }

    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { name: 'asc' },
            include: { role: true, office: true, department: true, division: true, district: true, branch: true }
        }),
        prisma.user.count({ where })
    ]);

    return {
        users: users.map(u => { const { hashedPassword, ...rest } = u; return rest as User; }),
        total,
        totalPages: Math.ceil(total / limit),
        page,
        limit
    };
}

export async function getRoles() {
    return await prisma.role.findMany();
}

export async function saveRole(data: { id?: string, name: string, permissions: any }) {
    const user = await hasPermission('manage_roles');
    if (data.id) {
        await prisma.role.update({ where: { id: data.id }, data: { ...data, permissions: data.permissions.join(',') } });
    } else {
        await prisma.role.create({ data: { ...data, permissions: data.permissions.join(',') } });
    }
    revalidatePath('/dashboard/admin/roles');
}

export async function deleteRole(id: string) {
    const user = await hasPermission('manage_roles');
    await prisma.role.delete({ where: { id } });
    revalidatePath('/dashboard/admin/roles');
    return { success: true };
}

export async function getDivisions() { return await prisma.division.findMany({ include: { department: true }}); }
export async function getDepartments() { return await prisma.department.findMany({ include: { office: true }}); }
export async function getBranches() { return await prisma.branch.findMany({ include: { district: true }}); }
export async function getDistricts() { return await prisma.district.findMany({ include: { office: true } }); }
export async function getOffices() { return await prisma.office.findMany({ include: { departments: true, districts: true } }); }
export async function getUsers() {
    const users = await prisma.user.findMany({ include: { role: true, office: true, department: true, division: true, district: true, branch: true }, orderBy: { name: 'asc' } });
    return users.map(user => { const { hashedPassword, ...userWithoutPassword } = user; return userWithoutPassword; });
}

export async function revokeUserTokens(userId: string) {
    const user = await getLoggedInUser();
    if (!user || (user.id !== userId && !((user.role?.permissions || '').includes('manage_users')))) {
        throw new Error("Unauthorized");
    }
    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    return { success: true };
}

export async function getEmailLogs(page = 1, limit = 10, filters: { status?: string; query?: string } = {}) {
    await hasPermission('admin');
    const where: Prisma.EmailLogWhereInput = {};
    const [logs, total] = await prisma.$transaction([
        prisma.emailLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }}),
        prisma.emailLog.count({ where })
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSecurityLogs(page = 1, limit = 15, filters: { severity?: string; query?: string } = {}) {
    await hasPermission(['admin', 'view_audit_logs' as any]);
    const where: Prisma.SecurityLogWhereInput = {};
    const [logs, total] = await prisma.$transaction([
        prisma.securityLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { timestamp: 'desc' }, include: { actor: true }}),
        prisma.securityLog.count({ where })
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function completeOnboardingTour() {
    const user = await getLoggedInUser();
    if (!user) throw new Error("Not authenticated");
    await prisma.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } });
    revalidatePath('/dashboard');
    return { success: true };
}

export async function verifyPasswordResetToken(token: string) {
    const hashedToken = require('crypto').createHash('sha256').update(token).digest('hex');
    const tokenEntry = await prisma.passwordResetToken.findFirst({ where: { token: hashedToken, expires: { gt: new Date() } } });
    if (!tokenEntry) return { error: "Invalid or expired link." };
    return { success: true, email: tokenEntry.email };
}

export async function setPasswordWithToken({ token, password }: { token: string, password: string}) {
    const hashedToken = require('crypto').createHash('sha256').update(token).digest('hex');
    const tokenEntry = await prisma.passwordResetToken.findFirst({ where: { token: hashedToken } });
    if (!tokenEntry || tokenEntry.expires < new Date()) return { error: "Invalid link." };
    const user = await prisma.user.findUnique({ where: { email: tokenEntry.email }});
    if (!user) return { error: "User not found." };
    const bcrypt = require('bcrypt');
    const newHashedPassword = await bcrypt.hash(password, 10);
    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { hashedPassword: newHashedPassword, status: 'active', tokenVersion: { increment: 1 } } }),
        prisma.passwordResetToken.delete({ where: { email: tokenEntry.email } })
    ]);
    return { success: true };
}

export async function changeUserPassword(password: string) {
    const user = await getLoggedInUser();
    if (!user) return { success: false, error: 'Not authenticated.' };
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { hashedPassword, tokenVersion: { increment: 1 } } });
    return { success: true };
}

export async function bulkImportUsers(fileData: string): Promise<BulkImportResult> {
    await hasPermission('manage_users');
    // Simplified bulk import logic for onboarding
    return { successCount: 0, errorCount: 0, errors: [] };
}

export async function updateUserProfile(userId: string, data: { name: string, email: string, avatar?: string, signature?: string }) {
    const user = await getLoggedInUser();
    if (!user || user.id !== userId) throw new Error("Unauthorized");
    await prisma.user.update({ where: { id: userId }, data: { name: data.name, avatar: data.avatar, signature: data.signature } });
    revalidatePath('/dashboard');
    return { success: true };
}
