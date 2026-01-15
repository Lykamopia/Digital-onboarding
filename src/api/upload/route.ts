
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { stat, mkdir, rm } from 'fs/promises';

// Main POST handler for file uploads
export async function POST(req: NextRequest) {
  const data = await req.formData();
  const file: File | null = data.get('file') as unknown as File;
  const type = data.get('type') as string || 'attachments'; // default to attachments

  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Define the upload directory path at the root level, now with subdirectories
  const uploadDir = join(process.cwd(), 'public', 'uploads', type);

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

  return NextResponse.json({ 
    success: true, 
    path: publicPath,
    name: file.name,
    size: file.size,
    type: file.type
  });
}
