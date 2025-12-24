
'use client';

import { Loader2 } from 'lucide-react';

export function HoneycombLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-sm font-semibold text-primary/80 tracking-widest">LOADING...</div>
    </div>
  );
}
