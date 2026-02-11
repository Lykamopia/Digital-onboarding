
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, normalize } from 'path';
import mime from 'mime-types';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { Attachment, LoggedInUser } from '@/lib/types';
import { LogSeverity } from '@/lib/types';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse('Authentication required', { status: 401 });
    }

    const filePathParts = params.path;
    if (!filePathParts || filePathParts.length === 0) {
        return new NextResponse('File not found', { status: 404 });
    }

    const [fileType, ...fileNameParts] = filePathParts;
    const relativePath = join(...filePathParts); // e.g., "attachments/123-file.pdf"
    const dbPath = `/uploads/${relativePath}`; // e.g., "/uploads/attachments/123-file.pdf"
    let attachment: Attachment | null = null;


    // --- Authorization Check ---
    if (fileType === 'attachments') {
        const userWithRole = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: { select: { permissions: true } } }
        });
        const userPermissions = userWithRole?.role?.permissions?.split(',') || [];
        const isAdminWithAuditLog = userPermissions.includes('manage_audit_log');

        attachment = await prisma.attachment.findFirst({
            where: { url: dbPath }
        });

        if (!attachment || !attachment.memoId) {
            return new NextResponse('Forbidden: Attachment record not found.', { status: 403 });
        }

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

        const currentUserId = session.user.id;
        
        let hasAccess = 
            memo.fromId === currentUserId ||
            memo.current_holderId === currentUserId ||
            memo.to.some(user => user.id === currentUserId) ||
            memo.cc.some(user => user.id === currentUserId) ||
            isAdminWithAuditLog;
        
        const sessionUser = session.user as LoggedInUser;
        if (sessionUser.actingUser && !sessionUser.delegationPermissions?.includes('delegation:view')) {
            hasAccess = false;
        }
            
        if (!hasAccess) {
             await logSecurityEvent({
                event: SecurityEvent.PERMISSION_DENIED,
                severity: LogSeverity.WARN,
                actor: session.user,
                details: `User attempted to access unauthorized attachment: ${dbPath}`,
                targetId: attachment.id,
                targetType: 'Attachment'
             });
             return NextResponse.redirect(new URL('/dashboard/access-denied', req.url));
        }
    } else if (fileType !== 'profile' && fileType !== 'signatures') {
        // Any authenticated user can view profile pics and signatures.
        return new NextResponse('Forbidden: Invalid file category.', { status: 403 });
    }
    // --- End Authorization Check ---

    const uploadsDir = join(process.cwd(), 'uploads');
    const absolutePath = normalize(join(uploadsDir, relativePath));

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
            actor: session.user,
            details: `User downloaded file: ${dbPath}`,
            targetId: attachment?.id || dbPath,
            targetType: fileType,
        });

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileBuffer.length.toString(),
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
