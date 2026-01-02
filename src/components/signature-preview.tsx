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

  return (
    <div className={cn(wrapperClass, className)}>
      {
        // Use native <img> for data URLs or internal upload/API paths to avoid next/image optimization/validation issues.
        (src.startsWith('data:') || src.startsWith('/uploads') || src.startsWith('/api') || src.startsWith('uploads')) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            width={compactWidth}
            height={compactHeight}
            className="object-contain animate-in fade-in duration-300"
            onError={(e) => {
              // Hide broken image so alt/fallback is visible
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            width={compactWidth}
            height={compactHeight}
            className="object-contain animate-in fade-in duration-300"
            priority={priority}
          />
        )
      }
    </div>
  );
}

export default SignaturePreview;
