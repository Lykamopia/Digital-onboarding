
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join, normalize } from 'path';
import { stat, mkdir, rm } from 'fs/promises';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';

// Set a body size limit for file uploads to 10MB
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

// Main POST handler for file uploads
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const data = await req.formData();
  const file: File | null = data.get('file') as unknown as File;
  const type = data.get('type') as string || 'attachments';

  // --- RBAC Check ---
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: { select: { permissions: true } } }
  });

  const canUploadAttachments = user?.role?.permissions?.includes('admin') || user?.role?.permissions?.includes('maker_customer_onboarding');

  if (type === 'attachments' && !canUploadAttachments) {
     return NextResponse.json({ success: false, error: 'You do not have permission to upload attachments.' }, { status: 403 });
  }
  // Any authenticated user can upload profile/signature images for themselves.
  // --- End RBAC Check ---


  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Define the upload directory path at the root level
  const uploadDir = join(process.cwd(), 'uploads', type);

  // Ensure the upload directory exists
  try {
    await stat(uploadDir);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      await mkdir(uploadDir, { recursive: true });
    } else {
      console.error('Error creating upload directory:', e);
      return NextResponse.json({ success: false, error: 'Could not create upload directory' }, { status: 500 });
    }
  }

  // Sanitize the filename to prevent security risks
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9-._]/g, '_');
  const uniqueFilename = `${Date.now()}-${sanitizedFilename}`;
  const path = join(uploadDir, uniqueFilename);
  
  // Write the file to the server
  try {
    await writeFile(path, buffer);
  } catch (error) {
    console.error('Error writing file:', error);
    return NextResponse.json({ success: false, error: 'Failed to save file' }, { status: 500 });
  }
  
  // Return the public path relative to the root
  const publicPath = `/uploads/${type}/${uniqueFilename}`;
  
  await logSecurityEvent({
    event: SecurityEvent.FILE_UPLOAD_SUCCESS,
    severity: LogSeverity.INFO,
    actor: session.user,
    details: `User uploaded file '${file.name}' (${file.size} bytes) of type '${type}'.`,
    targetId: publicPath
  });

  return NextResponse.json({ 
    success: true, 
    path: publicPath,
    name: file.name,
    size: file.size,
    type: file.type
  });
}


// DELETE handler for removing uploaded files
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const data = await req.json();
  const relativePath = data.path as string;

  if (!relativePath) {
    return NextResponse.json({ success: false, error: 'No file path provided' }, { status: 400 });
  }

  // --- Ownership Check ---
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  // A user can only delete a file if it's their current avatar or signature.
  // This prevents deleting arbitrary files.
  if (relativePath !== user?.avatar && relativePath !== user?.signature) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  // --- End Ownership Check ---

  // Path received will be like "/uploads/profile/some-file.png"
  // We need to map it to the root "uploads" folder
  const basePath = process.cwd();
  const absolutePath = join(basePath, relativePath);

  // Security check: ensure the resolved path is within the root 'uploads' directory
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!absolutePath.startsWith(uploadsDir)) {
    return NextResponse.json({ success: false, error: 'Invalid file path' }, { status: 403 });
  }
  
  try {
    await rm(absolutePath);
    return NextResponse.json({ success: true, message: 'File deleted successfully.' });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File not found is not an error in this context.
      return NextResponse.json({ success: true, message: 'File not found, but operation is successful.' });
    }
    console.error('Error deleting file:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete file' }, { status: 500 });
  }
}
