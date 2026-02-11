
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import mime from 'mime-types';
import { getLoggedInUser } from '@/app/actions/memo';
import prisma from '@/lib/prisma';
import type { Attachment, LoggedInUser } from '@/lib/types';
import { LogSeverity } from '@/lib/types';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
    const user = await getLoggedInUser();
    if (!user) {
        return new NextResponse('Authentication required', { status: 401 });
    }

    const filePathParts = params.path;
    if (!filePathParts || filePathParts.length === 0) {
        return new NextResponse('File not found', { status: 404 });
    }

    const [fileType, ...fileNameParts] = filePathParts;
    // Construct DB path with forward slashes for universal matching
    const dbPath = `/uploads/${filePathParts.join('/')}`;
    let isAuthorized = false;
    let eventTarget: { id: string, type: string } | null = null;


    // --- Authorization Check ---
    if (fileType === 'attachments') {
        const attachment = await prisma.attachment.findFirst({
            where: { url: dbPath }
        });

        if (!attachment || !attachment.memoId) {
            return new NextResponse('Forbidden: Attachment record not found.', { status: 403 });
        }
        eventTarget = { id: attachment.id, type: 'Attachment' };

        const memo = await prisma.memo.findUnique({
            where: { id: attachment.memoId },
            select: { 
                fromId: true,
                to: { select: { id: true } },
                cc: { select: { id: true } },
                current_holderId: true,
            }
        });

        if (!memo) {
             return new NextResponse('Forbidden: Associated memo not found.', { status: 403 });
        }

        const currentUserId = user.id;
        const isAdminWithAuditLog = user.role?.permissions?.includes('manage_audit_log');
        
        let hasMemoAccess = 
            memo.fromId === currentUserId ||
            memo.current_holderId === currentUserId ||
            memo.to.some(u => u.id === currentUserId) ||
            memo.cc.some(u => u.id === currentUserId) ||
            isAdminWithAuditLog;
        
        if (user.actingUser && !user.delegationPermissions?.includes('delegation:view')) {
            hasMemoAccess = false;
        }

        if (hasMemoAccess) {
            isAuthorized = true;
        }

    } else if (fileType === 'profile') {
        // Profile pictures are viewable by any authenticated user for UI purposes.
        isAuthorized = true;
        eventTarget = { id: dbPath, type: 'Profile' };

    } else if (fileType === 'signatures') {
        // Signatures are private and can only be accessed by the owner.
        const fileOwner = await prisma.user.findFirst({
            where: { signature: dbPath },
            select: { id: true },
        });

        if (fileOwner) {
            eventTarget = { id: fileOwner.id, type: 'Signature' };
            if (fileOwner.id === user.id) {
                isAuthorized = true;
            }
        }
        // If fileOwner is not found, isAuthorized remains false, access will be denied.
    }
    // --- End Authorization Check ---

    if (!isAuthorized) {
        await logSecurityEvent({
            event: SecurityEvent.PERMISSION_DENIED,
            severity: LogSeverity.WARN,
            actor: user.actingUser || user,
            details: `User attempted to access unauthorized file: ${dbPath}`,
            targetId: eventTarget?.id || dbPath,
            targetType: eventTarget?.type || fileType,
        });
        return new NextResponse('Forbidden: You do not have permission to access this file.', { status: 403 });
    }

    const uploadsDir = join(process.cwd(), 'uploads');
    const absolutePath = join(uploadsDir, ...filePathParts);

    // Security check: Prevent path traversal attacks by ensuring the path is within the uploads directory.
    if (!absolutePath.startsWith(uploadsDir)) {
        return new NextResponse('Invalid file path', { status: 403 });
    }

    try {
        const fileBuffer = await readFile(absolutePath);
        const contentType = mime.lookup(absolutePath) || 'application/octet-stream';
        
        await logSecurityEvent({
            event: SecurityEvent.FILE_DOWNLOAD_SUCCESS,
            severity: LogSeverity.INFO,
            actor: user.actingUser || user,
            details: `User downloaded file: ${dbPath}`,
            targetId: eventTarget?.id || dbPath,
            targetType: eventTarget?.type || fileType,
        });

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileNameParts.join('')}"`,
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new NextResponse('File not found', { status: 404 });
        }
        console.error('Error reading file:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
