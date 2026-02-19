
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

/**
 * SignaturePreview renders a digital signature image with built-in security features
 * to prevent right-click downloading or direct file access interaction.
 */
export function SignaturePreview({
  src,
  alt = 'Signature',
  className = '',
  width,
  height,
  compact = false,
  priority = false,
}: SignaturePreviewProps) {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (src) {
      setError(false);
    }
  }, [src]);

  // Normalize src: ensure internal paths are absolute from root and handle data URLs
  const normalizedSrc = React.useMemo(() => {
    if (!src) return src;
    const t = src.trim();
    if (t.startsWith('http') || t.startsWith('data:') || t.startsWith('/')) return t;
    return `/${t}`;
  }, [src]);

  const compactWidth = width ?? (compact ? 40 : 60);
  const compactHeight = height ?? (compact ? 20 : 30);

  const wrapperClass = compact
    ? 'inline-flex items-center justify-center rounded-md border px-2 py-1 bg-muted/5'
    : 'inline-block';

  // Security handlers to prevent direct interaction with the signature image
  const handleSecurity = (e: React.UIEvent) => {
    e.preventDefault();
  };

  if (!normalizedSrc || error) {
      const fallbackWidth = width ? `${width}px` : '100%';
      const fallbackHeight = height ? `${height}px` : '100%';
      return (
          <div className={cn(
              wrapperClass,
              'flex items-center justify-center bg-muted/50 text-muted-foreground',
              className
          )} style={{width: fallbackWidth, height: fallbackHeight, display: 'flex'}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </div>
      );
  }

  return (
    <div 
        className={cn(wrapperClass, "select-none relative group", className)}
        onContextMenu={handleSecurity}
        onDragStart={handleSecurity}
    >
      <Image
        src={normalizedSrc as string}
        alt={alt}
        width={compactWidth}
        height={compactHeight}
        className="object-contain animate-in fade-in duration-300 pointer-events-none"
        priority={priority}
        unoptimized={
          // Use unoptimized for data URLs and for same-origin upload routes
          !normalizedSrc || (normalizedSrc as string).startsWith('data:') || !(normalizedSrc as string).startsWith('http')
        }
        onError={() => setError(true)}
      />
      {/* Invisible overlay to further block interaction if needed */}
      <div className="absolute inset-0 z-10 bg-transparent" aria-hidden="true" />
    </div>
  );
}

export default SignaturePreview;
