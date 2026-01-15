
'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SignaturePreviewProps {
  src?: string | null;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  compact?: boolean;
  priority?: boolean;
}

export function SignaturePreview({
  src,
  alt = 'Signature',
  className = '',
  width,
  height,
  compact = false,
  priority = false,
}: SignaturePreviewProps) {
  if (!src) return null;

  const compactWidth = width ?? (compact ? 40 : 60);
  const compactHeight = height ?? (compact ? 20 : 30);

  const wrapperClass = compact
    ? 'inline-flex items-center justify-center rounded-md border px-2 py-1 bg-muted/5'
    : 'inline-block';

  // The src can be a data URL (from drawing) or a path (from upload).
  // Next.js Image component can handle both.
  return (
    <div className={cn(wrapperClass, className)}>
      <Image
        src={src}
        alt={alt}
        width={compactWidth}
        height={compactHeight}
        className="object-contain animate-in fade-in duration-300"
        priority={priority}
        unoptimized={src.startsWith('data:')} // Important for data URLs
      />
    </div>
  );
}

export default SignaturePreview;
