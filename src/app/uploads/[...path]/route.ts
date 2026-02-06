import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, normalize } from 'path';
import mime from 'mime-types';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
    const filePathParts = params.path;
    if (!filePathParts || filePathParts.length === 0) {
        return new NextResponse('File not found', { status: 404 });
    }

    const uploadsDir = join(process.cwd(), 'uploads');
    const relativePath = join(...filePathParts);
    const absolutePath = normalize(join(uploadsDir, relativePath));

    // Security check: Prevent path traversal attacks
    if (!absolutePath.startsWith(uploadsDir)) {
        return new NextResponse('Invalid file path', { status: 403 });
    }

    try {
        const fileBuffer = await readFile(absolutePath);
        const contentType = mime.lookup(absolutePath) || 'application/octet-stream';
        
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileBuffer.length.toString(),
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
