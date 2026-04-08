
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { stat, mkdir, rm } from 'fs/promises';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import mime from 'mime-types';

export const dynamic = 'force-dynamic';

// Set a body size limit for file uploads to 10MB
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

const ALLOWED_UPLOAD_TYPES = ['profile', 'customer-photos'];
const BLOCKED_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.sh', '.js', '.jsx', '.ts', '.tsx',
  '.vbs', '.ps1', '.jar', '.py', '.php', '.pl', '.rb', '.swf', '.html', '.htm'
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, matching config

// Main POST handler for file uploads
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    const rawType = data.get('type') as string || 'profile';

    // --- Whitelist Validation for Upload Type (Primary Defense against Path Traversal) ---
    // Strict comparison against a known safe set of strings.
    const type = ALLOWED_UPLOAD_TYPES.find(t => t === rawType);
    if (!type) {
      return NextResponse.json({ success: false, error: 'Invalid upload type.' }, { status: 400 });
    }
    // --- End Whitelist Validation ---

    // Any authenticated user can upload profile or customer-photos for themselves.
    // Attachments and Signatures are explicitly excluded from this handler as per requirements.


    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // --- File Validation ---
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File size exceeds the 10MB limit.' }, { status: 413 });
    }

    const filename = file.name.toLowerCase();
    const fileExtension = `.${filename.split('.').pop()}`;

    if (BLOCKED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json({ success: false, error: `File type (${fileExtension}) is not allowed.` }, { status: 400 });
    }
    
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        // Double check MIME type server-side, as client-sent type can be spoofed.
        const serverMimeType = mime.lookup(filename);
        if (serverMimeType && !ALLOWED_IMAGE_TYPES.includes(serverMimeType)) {
            return NextResponse.json({ success: false, error: `Invalid image file type. Server detected: ${serverMimeType}.` }, { status: 400 });
        }
    } else {
        return NextResponse.json({ success: false, error: 'Only image files (JPEG, PNG, GIF, WEBP) are allowed.' }, { status: 400 });
    }
    // --- End File Validation ---

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Define the upload directory path at the root level
    const uploadsDir = join(process.cwd(), 'uploads');
    const uploadDir = join(uploadsDir, type);

    // Boundary check: ensure the resolved upload directory is within the 'uploads' directory
    const resolvedUploadDir = join(process.cwd(), 'uploads', type);
    if (!resolvedUploadDir.startsWith(uploadsDir)) {
      return NextResponse.json({ success: false, error: 'Invalid directory path.' }, { status: 403 });
    }

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
    // 1. Get the base name to strip any path components
    const baseFilename = file.name.split(/[\\/]/).pop() || 'file';
    // 2. Remove any characters that aren't alphanumeric, dots, underscores or dashes
    const sanitizedFilename = baseFilename.replace(/[^a-zA-Z0-9-._]/g, '_');
    // 3. Ensure it doesn't start with a dot to prevent hidden files
    const finalFilename = sanitizedFilename.startsWith('.') ? `file${sanitizedFilename}` : sanitizedFilename;
    
    const uniqueFilename = `${Date.now()}-${finalFilename}`;
    const path = join(uploadDir, uniqueFilename);
    
    // Boundary check for the final file path
    if (!path.startsWith(uploadsDir)) {
      return NextResponse.json({ success: false, error: 'Invalid file path.' }, { status: 403 });
    }

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
  } catch (error: any) {
    console.error('[POST /api/internal/upload] Fatal Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}


// DELETE handler for removing uploaded files
export async function DELETE(req: NextRequest) {
  try {
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
    // Use path.normalize to resolve any ".." or "." in the input path
    const normalizedPath = join('/', relativePath);
    const absolutePath = join(basePath, normalizedPath);

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
  } catch (error: any) {
    console.error('[DELETE /api/internal/upload] Fatal Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
