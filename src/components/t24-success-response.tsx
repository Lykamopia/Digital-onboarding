'use client';

import { CheckCircle, ChevronDown, Clipboard, Smartphone, User, CreditCard, Link, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';

function InfoRow({ 
  label, 
  value, 
  copyable, 
  isStatus 
}: { 
  label: string; 
  value: any; 
  copyable?: boolean;
  isStatus?: boolean;
}) {
  if (value === null || value === undefined) return null;
  
  const displayValue = typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value);
  const isPositive = displayValue.toUpperCase() === 'YES' || displayValue.toUpperCase() === 'SUCCESS' || value === true;
  const isNegative = displayValue.toUpperCase() === 'NO' || value === false;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      <div className="flex items-center gap-2">
        {isStatus ? (
          <Badge 
            variant="outline" 
            className={cn(
              "h-5 text-[10px] font-bold px-1.5",
              isPositive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : 
              isNegative ? "bg-amber-100 text-amber-700 border-amber-200" : ""
            )}
          >
            {displayValue}
          </Badge>
        ) : (
          <p className="text-sm font-semibold text-primary/90">{displayValue}</p>
        )}
        
        {copyable && value && (
          <button 
            onClick={() => { navigator.clipboard.writeText(String(value)); toast.success('Copied to clipboard!'); }}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <Clipboard className="h-3 w-3 text-muted-foreground hover:text-primary" />
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
  const message = get('message');
  const customerId = get('customerId');
  const accountNumber = get('accountNumber');
  const productId = get('productId');
  const customerExists = get('customerExists');
  const isDigitalCustomer = get('isDigitalCustomer');
  const accountExists = get('accountExists');
  const isDigitalAccount = get('isDigitalAccount');
  const linkingError = get('linkingError');
  const transactionId = get('transactionId');

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10 overflow-hidden shadow-sm">
      <div className="bg-emerald-100/50 dark:bg-emerald-900/20 px-4 py-3 border-b border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500 rounded-full p-1">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300 tracking-tight">T24 Core Banking Response</h3>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]">
          {status?.toUpperCase() || 'SUCCESS'}
        </Badge>
      </div>

      <div className="p-4 space-y-6">
        {/* Main Identity Info */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <InfoRow label="Customer ID" value={customerId} copyable />
          <InfoRow label="Account Number" value={accountNumber} copyable />
          <InfoRow label="Product ID" value={productId} />
          {transactionId && <InfoRow label="Transaction ID" value={transactionId} copyable />}
        </div>

        {/* Messaging */}
        {message && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-background/50 border border-emerald-100 dark:border-emerald-900/30">
            <Smartphone className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-800/80 dark:text-emerald-400 leading-relaxed font-medium">
              {message}
            </p>
          </div>
        )}

        <Separator className="bg-emerald-200/50 dark:bg-emerald-900/30" />

        {/* SuperApp Linking & Status */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Link className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary/70">SuperApp & Digital Status</h4>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-background/40 p-3 rounded-lg border border-emerald-100/50 dark:border-emerald-900/20">
            <InfoRow label="Customer Exists" value={customerExists} isStatus />
            <InfoRow label="Digital Customer" value={isDigitalCustomer} isStatus />
            <InfoRow label="Account Exists" value={accountExists} isStatus />
            <InfoRow label="Digital Account" value={isDigitalAccount} isStatus />
          </div>

          {linkingError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">SuperApp Linking Warning</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 font-medium">
                  {linkingError}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Raw Toggle */}
        <div className="pt-2">
          <button 
            onClick={() => setRawVisible(!isRawVisible)} 
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all group"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform duration-300', isRawVisible && 'rotate-180')} />
            {isRawVisible ? 'Hide' : 'View'} Raw API Payload
          </button>
          <AnimatePresence>
            {isRawVisible && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 text-[10px] font-mono bg-black/5 dark:bg-black/40 p-4 rounded-lg border border-border/50 text-muted-foreground break-all whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(response, null, 2)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
