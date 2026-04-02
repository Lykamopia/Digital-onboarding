
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

    const requestHeaders = req.headers;
    const fetchDest = requestHeaders.get('sec-fetch-dest');

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
        
        let hasMemoAccess = 
            memo.fromId === currentUserId ||
            memo.current_holderId === currentUserId ||
            memo.to.some(u => u.id === currentUserId) ||
            memo.cc.some(u => u.id === currentUserId);
        
        if (user.actingUser && !user.delegationPermissions?.includes('delegation:view')) {
            hasMemoAccess = false;
        }

        if (hasMemoAccess) {
            isAuthorized = true;
        }

    } else if (fileType === 'profile' || fileType === 'signatures' || fileType === 'customer-photos') {
        // Profile pictures, signatures, and customer photos are viewable by any authenticated user for UI purposes...
        // BUT direct access (entering the URL in address bar) is restricted for other users' signatures.
        
        const typeMap: Record<string, string> = {
            'profile': 'Profile',
            'signatures': 'Signature',
            'customer-photos': 'CustomerPhoto'
        };
        const type = typeMap[fileType] || 'Unknown';
        eventTarget = { id: dbPath, type };

        if (fileType === 'signatures') {
            const signatureOwner = await prisma.user.findFirst({
                where: { signature: dbPath },
                select: { id: true }
            });

            const isOwnSignature = signatureOwner?.id === user.id;
            
            // sec-fetch-dest: document means the user typed the URL or clicked a direct link (not an <img> tag)
            const isDirectAccessAttempt = fetchDest === 'document';

            if (isDirectAccessAttempt && !isOwnSignature) {
                await logSecurityEvent({
                    event: SecurityEvent.PERMISSION_DENIED,
                    severity: LogSeverity.WARN,
                    actor: user.actingUser || user,
                    details: `Unauthorized direct access attempt to signature: ${dbPath}. Destination: ${fetchDest}`,
                    targetId: dbPath,
                    targetType: 'Signature',
                });
                return new NextResponse('Forbidden: Direct access to other users signatures is prohibited.', { status: 403 });
            }
            isAuthorized = true;
        } else {
            // profile and customer-photos are viewable by any authenticated user
            isAuthorized = true;
        }
    } else {
        return new NextResponse('Forbidden: Invalid upload category.', { status: 403 });
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

    if (!absolutePath.startsWith(uploadsDir)) {
        return new NextResponse('Invalid file path', { status: 403 });
    }

    try {
        const fileBuffer = await readFile(absolutePath);
        const contentType = mime.lookup(absolutePath) || 'application/octet-stream';
        
        const isDownload = fileType === 'attachments';
        const event = isDownload ? SecurityEvent.FILE_DOWNLOAD_SUCCESS : SecurityEvent.FILE_PREVIEW_SUCCESS;
        const actionVerb = isDownload ? 'downloaded' : 'previewed';

        await logSecurityEvent({
            event: event,
            severity: LogSeverity.INFO,
            actor: user.actingUser || user,
            details: `User successfully ${actionVerb} file: ${dbPath}`,
            targetId: eventTarget?.id || dbPath,
            targetType: eventTarget?.type || fileType,
        });

        const headers = new Headers();
        headers.set('Content-Type', contentType);
        
        const disposition = isDownload ? 'attachment' : 'inline';
        headers.set('Content-Disposition', `${disposition}; filename="${fileNameParts.join('')}"`);
        
        if (fileType === 'signatures') {
            headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            headers.set('Pragma', 'no-cache');
            headers.set('Expires', '0');
            headers.set('X-Content-Type-Options', 'nosniff');
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: headers,
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new NextResponse('File not found', { status: 404 });
        }
        console.error('Error reading file:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
