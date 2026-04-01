'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Global handler for ChunkLoadError and Unexpected Token errors.
 * These typically occur when a new deployment happens and the browser tries to 
 * load a chunk that no longer exists on the server, or when a request for a JS chunk 
 * is intercepted by a router returning an HTML page.
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = (event instanceof ErrorEvent) ? event.error : (event as any).reason;
      const message = error?.message || (event as any).message || '';
      
      const isChunkLoadError = 
        message.includes('ChunkLoadError') || 
        message.includes('loading chunk') ||
        message.includes('Unexpected token') ||
        message.includes('Unexpected identifier');

      if (isChunkLoadError) {
        console.error('[ChunkErrorHandler] Detected loading failure:', message);
        
        // Prevent infinite reload loop by using sessionStorage
        const lastReload = sessionStorage.getItem('chunk_error_reload_at');
        const now = Date.now();
        
        // Only auto-reload if we haven't reloaded in the last 15 seconds
        if (!lastReload || now - parseInt(lastReload) > 15000) {
          sessionStorage.setItem('chunk_error_reload_at', now.toString());
          
          toast.error("Application Update Required", {
            description: "A new version of the app is available. Refreshing to update...",
            duration: 5000,
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // If we are in a reload loop, just show a message with a manual refresh button
          toast.error("Loading Error", {
            description: "There was an issue loading the latest components. Please refresh your browser manually.",
            action: {
              label: "Refresh Now",
              onClick: () => window.location.reload(),
            },
            duration: Infinity,
          });
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return null;
}
