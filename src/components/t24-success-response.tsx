'use client';

import { CheckCircle, ChevronDown, Clipboard } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function InfoRow({ label, value, copyable }: { label: string; value: string | null | undefined; copyable?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-primary/80">{value}</p>
        {copyable && (
          <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied to clipboard!'); }}>
            <Clipboard className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
}

export function T24SuccessResponse({ response }: { response: any }) {
  const [isRawVisible, setRawVisible] = useState(false);

  if (!response || typeof response !== 'object') {
    return null;
  }

  // Normalize keys (case-insensitive)
  const get = (key: string) => {
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(response).find(k => k.toLowerCase() === lowerKey);
    return foundKey ? response[foundKey] : undefined;
  };

  const status = get('status');
  const transactionId = get('transactionId');
  const accountNumber = get('accountNumber');
  const accountHolderName = get('accountHolderName');
  const message = get('message');

  return (
    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-6 w-6 text-emerald-500" />
        <div>
          <h3 className="font-bold text-emerald-700 dark:text-emerald-300">T24 Core Banking Success</h3>
          <p className="text-xs text-emerald-600 dark:text-emerald-400/80">The record was successfully processed by the core system.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5 pl-2 border-l-2 border-emerald-200/80 dark:border-emerald-900/50 ml-2">
        <InfoRow label="Status" value={status} />
        <InfoRow label="Transaction ID" value={transactionId} copyable />
        <InfoRow label="Account Number" value={accountNumber} copyable />
        <InfoRow label="Account Holder" value={accountHolderName} />
        {message && <div className="col-span-full"><InfoRow label="Message" value={message} /></div>}
      </div>

      <div className="pt-2">
        <button onClick={() => setRawVisible(!isRawVisible)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isRawVisible && 'rotate-180')} />
          {isRawVisible ? 'Hide' : 'View'} Raw Response
        </button>
        {isRawVisible && (
          <div className="mt-2 text-[11px] font-mono bg-background/60 p-3 rounded border border-border text-muted-foreground break-all whitespace-pre-wrap">
            {JSON.stringify(response, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}
