import { writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import mime from 'mime-types';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'customer-photos');

export interface ImageProcessingResult {
  success: boolean;
  filePath?: string;
  error?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Processes a base64-encoded image: decodes, validates, and stores it.
 * @param base64Data The base64-encoded image string (with or without data URI prefix).
 * @returns An object containing the success status and the relative file path.
 */
export async function processBase64Image(base64Data: string): Promise<ImageProcessingResult> {
  try {
    // 1. Extract mime type and raw base64 data
    const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    
    let mimeType: string;
    let rawBase64: string;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      rawBase64 = matches[2];
    } else {
      // Fallback: try to detect if it's raw base64 without prefix (not recommended but possible)
      rawBase64 = base64Data;
      // We'll need to detect the type from the buffer
      mimeType = 'image/jpeg'; // Default assumption
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { success: false, error: `Unsupported image type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` };
    }

    // 3. Decode base64 to buffer
    const buffer = Buffer.from(rawBase64, 'base64');
    const size = buffer.length;

    // 4. Validate size
    if (size > MAX_IMAGE_SIZE) {
      return { success: false, error: `Image size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds the 5MB limit.` };
    }

    // 5. Generate unique filename and folder structure
    const extension = mime.extension(mimeType) || 'jpg';
    const timestamp = Date.now();
    const uuid = randomUUID();
    const filename = `${timestamp}-${uuid}.${extension}`;
    
    // Folder structure: YYYY/MM/DD for scalability
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    const relativeFolder = join(year, month, day);
    const absoluteFolder = join(UPLOAD_ROOT, relativeFolder);
    // Return path starting with /uploads/ for consistency with other upload routes
    const relativePath = `/uploads/customer-photos/${relativeFolder}/${filename}`.replace(/\\/g, '/');
    const absolutePath = join(UPLOAD_ROOT, relativeFolder, filename);

    // 6. Ensure directory exists
    await mkdir(absoluteFolder, { recursive: true });

    // 7. Write file
    await writeFile(absolutePath, buffer);

    // Note: In a real-world scenario, you might want to set permissions here.
    // On Windows, file permissions are handled differently than Linux.
    // For Node.js, we could use chmod but it's limited on Windows.

    return {
      success: true,
      filePath: relativePath,
      mimeType,
      size
    };
  } catch (error: any) {
    console.error('[ImageProcessor] Error processing base64 image:', error);
    return { success: false, error: error.message || 'An unknown error occurred during image processing.' };
  }
}

/**
 * Generates a hash for the image buffer to prevent duplicate storage.
 */
export function getImageHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
