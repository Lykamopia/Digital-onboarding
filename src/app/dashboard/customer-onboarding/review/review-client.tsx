'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  CheckCircle2, XCircle, RefreshCw, Eye, ChevronLeft, ChevronRight,
  Search, Clock, Building2, User, FileText, Loader2, AlertTriangle,
  Send, Filter, RotateCcw, ArrowRightLeft, ArrowUpDown, ChevronUp, ChevronDown, Calendar,
  Download, FileSpreadsheet, Copy, Check, X, ZoomIn,
} from 'lucide-react';
import Papa from 'papaparse';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { 
  reviewCustomerOnboarding, 
  listCustomerOnboardings, 
  getCustomerOnboarding,
  bulkReviewCustomerOnboarding,
  exportCustomerOnboardings,
  retryForwardToCoreBanking
} from '@/app/actions/customer-onboarding';
import { Button }     from '@/components/ui/button';
import { Input }      from '@/components/ui/input';
import { Badge }      from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator }  from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea }   from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Skeleton }   from '@/components/ui/skeleton';
import { Checkbox }   from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { CustomerOnboarding, CustomerOnboardingAuditLog } from '@/lib/types';

// Use string union until prisma generate runs
type ApprovalStatus = 'PENDING' | 'MAKER_APPROVED' | 'APPROVED' | 'REJECTED';

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline'; className: string }> = {
    PENDING:        { label: 'Pending Maker',   variant: 'secondary',  className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
    MAKER_APPROVED: { label: 'Pending Checker', variant: 'outline',    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
    APPROVED:       { label: 'Approved',        variant: 'default',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED:       { label: 'Rejected',        variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  };
  const cfg = map[status] || map.PENDING;
  return <Badge variant="outline" className={cn('font-medium text-xs', cfg.className)}>{cfg.label}</Badge>;
}

// ─── Audit timeline ───────────────────────────────────────────────────────────
function AuditTimeline({ logs }: { logs: CustomerOnboardingAuditLog[] }) {
  const iconMap: Record<string, React.ReactNode> = {
    SUBMITTED:      <Clock className="h-3.5 w-3.5 text-blue-500" />,
    MAKER_APPROVED: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
    APPROVED:       <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    REJECTED:       <XCircle className="h-3.5 w-3.5 text-red-500" />,
    FORWARDED:      <Send className="h-3.5 w-3.5 text-primary" />,
    FORWARD_FAILED: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  };
  return (
    <div className="relative pl-5 space-y-4">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
      {logs.map((log) => (
        <div key={log.id} className="relative flex gap-3">
          <div className="absolute -left-5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border z-10">
            {iconMap[log.action] || <RefreshCw className="h-3 w-3 text-muted-foreground" />}
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold">{log.action}</span>
              {log.actor && (
                <span className="text-xs text-muted-foreground">by {log.actor.name}</span>
              )}
            </div>
            {log.details && <p className="text-xs text-muted-foreground break-words">{log.details}</p>}
            <p className="text-[10px] text-muted-foreground/70">
              {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Customer avatar (photo or initials) ────────────────────────────────────
function CustomerAvatar({
  givenName,
  familyName,
  picture,
  size = 'lg',
  onClick,
}: {
  givenName?: string | null;
  familyName?: string | null;
  picture?: string | null;
  size?: 'sm' | 'lg';
  onClick?: () => void;
}) {
  const initials = [
    (givenName  || '').charAt(0),
    (familyName || '').charAt(0),
  ]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  const seed     = (givenName || '') + (familyName || '');
  const hue      = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const gradient   = `hsl(${hue},55%,45%)`;
  const gradientTo = `hsl(${(hue + 40) % 360},60%,35%)`;
  const dim        = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-10 w-10 text-sm';
  const clickable  = !!picture && !!onClick;

  if (picture) {
    return (
      <div
        className={cn(
          `${dim} rounded-full overflow-hidden ring-4 ring-background shadow-xl flex-shrink-0 relative group`,
          clickable && 'cursor-zoom-in',
        )}
        onClick={onClick}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
        aria-label={clickable ? 'View full photo' : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} alt={`${givenName} ${familyName}`} className="h-full w-full object-cover" />
        {clickable && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-xl ring-4 ring-background`}
      style={{ background: `linear-gradient(135deg, ${gradient}, ${gradientTo})` }}
    >
      {initials}
    </div>
  );
}

// ─── Data Row (Memoized for performance) ──────────────────────────────────────
const DataRow = React.memo(({ 
    rec, 
    index, 
    page, 
    pageSize, 
    isSelected, 
    onToggle, 
    onView 
}: { 
    rec: CustomerOnboarding; 
    index: number; 
    page: number; 
    pageSize: number; 
    isSelected: boolean; 
    onToggle: (checked: boolean) => void;
    onView: () => void;
}) => {
    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
                "border-b hover:bg-muted/30 transition-colors",
                isSelected && "bg-primary/5"
            )}
        >
            <td className="px-4 py-3">
                <Checkbox 
                    checked={isSelected}
                    onCheckedChange={onToggle}
                />
            </td>
            <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono text-center">
                {(page - 1) * pageSize + index + 1}
            </td>
            <td className="px-4 py-3 font-mono text-xs">{rec.mnemonic}</td>
            <td className="px-4 py-3">
                <div className="font-medium text-xs font-outfit">{rec.givenName} {rec.familyName}</div>
                <div className="text-muted-foreground text-[11px]">{rec.shortName}</div>
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                {(rec as any).submittedBy?.name || '—'}
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                {format(new Date(rec.createdAt), 'dd MMM yyyy')}
            </td>
            <td className="px-4 py-3">
                <StatusBadge status={rec.approvalStatus as any} />
            </td>
            <td className="px-4 py-3 text-xs hidden lg:table-cell font-outfit">
                {rec.forwardedAt
                ? <span className="text-emerald-600 dark:text-emerald-400">{format(new Date(rec.forwardedAt), 'dd MMM yyyy')}</span>
                : rec.forwardError
                    ? <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Failed</span>
                    : <span className="text-muted-foreground">—</span>}
            </td>
            <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={onView} className="h-7 px-2 hover:bg-primary/10 hover:text-primary transition-all">
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                </Button>
            </td>
        </motion.tr>
    );
});

DataRow.displayName = 'DataRow';

// ─── Copy-to-clipboard button ────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success(`${label || 'Value'} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy manually.');
    }
  }

  return (
    <button
      onClick={copy}
      title={`Copy ${label || 'value'}`}
      className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
    >
      {copied
        ? <Check className="h-3 w-3 text-emerald-500" />
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Record detail dialog ─────────────────────────────────────────────────────
function RecordDetailDialog({
  recordId,
  canReview,
  onClose,
  onRefresh,
}: {
  recordId: string;
  canReview: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { status: authStatus } = useSession();
  const [record, setRecord]           = useState<CustomerOnboarding | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [reviewNote, setReviewNote]   = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<'APPROVE' | 'REJECT' | 'RETRY' | null>(null);
  const requestRef = React.useRef(0);

  // ── Initial load ──────────────────────────────────────────────────────────
  const load = useCallback(async (retryCount = 0) => {
    // Validate identifier
    if (!recordId) {
      setError("No record identifier provided.");
      setLoading(false);
      return;
    }

    // Wait for auth to hydrate if it's currently loading
    if (authStatus === 'loading') return;
    
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      const result = await Promise.race([
        getCustomerOnboarding(recordId),
        timeoutPromise
      ]) as any;

      if (requestId !== requestRef.current) return;
      
      if (result.success) {
        setRecord(result.record as CustomerOnboarding);
      } else {
        // Simple automatic retry logic
        if (retryCount < 2) {
            console.log(`Retrying fetch for ${recordId}... (${retryCount + 1})`);
            setTimeout(() => load(retryCount + 1), 1000);
            return;
        }
        setError(result.error || "Failed to load record details.");
      }
    } catch (err: any) {
      if (requestId !== requestRef.current) return;
      
      if (retryCount < 2) {
          console.log(`Retrying fetch after error for ${recordId}... (${retryCount + 1})`);
          setTimeout(() => load(retryCount + 1), 1000);
          return;
      }

      const msg = err.message === 'TIMEOUT' ? "The request timed out." : "A network error occurred.";
      setError(msg);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [recordId, authStatus]);

  // Silent background refresh (no UI spinner flicker)
  const silentRefresh = useCallback(async () => {
    const requestId = requestRef.current;
    try {
      const result = await getCustomerOnboarding(recordId);
      if (requestId !== requestRef.current) return;
      if (result.success) {
        setRecord((prev) => {
          const next = result.record as CustomerOnboarding;
          if (
            prev?.approvalStatus !== next.approvalStatus ||
            prev?.forwardedAt   !== next.forwardedAt   ||
            prev?.forwardError  !== next.forwardError
          ) {
            return next;
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Silent refresh failed', err);
    }
  }, [recordId]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-refresh polling ───────────────────────────────────────────────────
  // Poll silently while the record is still "live" (PENDING or APPROVED-not-yet-forwarded)
  // so the UI reflects T24 sync completion and peer review decisions without manual refresh.
  useEffect(() => {
    if (!record) return;
    const isDone = record.forwardedAt || record.approvalStatus === 'REJECTED';
    if (isDone) return;

    const intervalMs = record.approvalStatus === 'APPROVED' ? 3000 : 5000;
    const id = setInterval(silentRefresh, intervalMs);
    return () => clearInterval(id);
  }, [record?.approvalStatus, record?.forwardedAt, silentRefresh]);

  // ── Lightbox keyboard dismiss ─────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen]);

  async function handleDecision(decision: 'APPROVED' | 'REJECTED') {
    setActionInProgress(decision === 'APPROVED' ? 'APPROVE' : 'REJECT');
    const result = await reviewCustomerOnboarding({ id: recordId, decision, note: reviewNote });
    if (result.success) {
      toast.success(`Submission ${decision.toLowerCase()} successfully.`);
      onRefresh();
      load();
    } else {
      toast.error(result.error);
    }
    setActionInProgress(null);
  }

  async function handleRetry() {
    setActionInProgress('RETRY');
    const result = await retryForwardToCoreBanking(recordId);
    if (result.success) {
      toast.success('Successfully forwarded to T24 core banking.');
      onRefresh();
      load();
    } else {
      toast.error(result.error || 'Failed to retry forwarding.');
      load();
    }
    setActionInProgress(null);
  }

  // InfoRow with inline copy-to-clipboard
  const InfoRow = ({ label, value, copyable = false }: { label: string; value?: string | null; copyable?: boolean }) =>
    value ? (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-start gap-0.5">
          <p className="text-sm font-medium break-all">{value}</p>
          {copyable && <CopyButton value={value} label={label} />}
        </div>
      </div>
    ) : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Onboarding Pipeline Detail
          </DialogTitle>
          <DialogDescription>
            Middleware request detail and automated audit trail
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          {loading || error ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
               {error ? (
                 <>
                   <AlertTriangle className="h-10 w-10 text-destructive/50" />
                   <div className="text-center space-y-1">
                     <p className="text-sm font-semibold">{error}</p>
                     <Button variant="outline" size="sm" onClick={load} className="mt-2 text-xs">Retry Load</Button>
                   </div>
                 </>
               ) : (
                 <>
                   <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                   <p className="text-sm text-muted-foreground animate-pulse font-outfit">Retrieving payload details...</p>
                 </>
               )}
            </div>
          ) : record ? (
            <div className="space-y-6 pb-4">
              {/* ── Hero header: avatar + primary identity ── */}
              <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                <CustomerAvatar
                  givenName={record.givenName}
                  familyName={record.familyName}
                  picture={(record as any).picture}
                  onClick={(record as any).picture ? () => setLightboxOpen(true) : undefined}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-base font-bold leading-tight">
                    {[record.title, record.fullName1 || `${record.givenName} ${record.familyName}`]
                      .filter(Boolean).join(' ')}
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground font-mono">{record.mnemonic}</p>
                    <CopyButton value={record.mnemonic} label="Mnemonic" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {record.gender}{record.dateOfBirth ? ` · ${record.dateOfBirth}` : ''}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <StatusBadge status={record.approvalStatus} />
                    {record.forwardedAt ? (
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                        <Send className="h-3 w-3 mr-1" /> Forwarded {format(new Date(record.forwardedAt), 'dd MMM yyyy')}
                      </Badge>
                    ) : record.approvalStatus === 'APPROVED' ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs animate-pulse">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Awaiting T24 sync…
                      </Badge>
                    ) : null}
                    {record.forwardError && !record.forwardedAt && (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Forward failed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Picture lightbox ── */}
              <AnimatePresence>
                {lightboxOpen && (record as any).picture && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <button
                      className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                      onClick={() => setLightboxOpen(false)}
                      aria-label="Close photo"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <motion.img
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.85, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      src={(record as any).picture}
                      alt={record.fullName1 || `${record.givenName} ${record.familyName}`}
                      className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Personal */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Payload Information (Ingested)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Mnemonic"       value={record.mnemonic}        copyable />
                  <InfoRow label="Title"           value={record.title} />
                  <InfoRow label="Given Name"      value={record.givenName} />
                  <InfoRow label="Family Name"     value={record.familyName} />
                  <InfoRow label="Full Name"       value={record.fullName1}      copyable />
                  <InfoRow label="Short Name"      value={record.shortName} />
                  <InfoRow label="Gender"          value={record.gender} />
                  <InfoRow label="Date of Birth"   value={record.dateOfBirth} />
                  <InfoRow label="Marital Status"  value={record.maritalStatus} />
                  <InfoRow label="Nationality"     value={record.nationality} />
                  <InfoRow label="National ID"     value={record.nationalIDNumber} copyable />
                  <InfoRow label="Mother's Name"   value={record.motherName} />
                </div>
              </div>
              <Separator />


              {/* Address */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Address</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Street"   value={record.street} />
                  <InfoRow label="Town/City" value={record.townCity} />
                  <InfoRow label="Country"  value={record.country} />
                  <InfoRow label="Region"   value={record.region} />
                  <InfoRow label="Sub-city" value={record.subcity} />
                  <InfoRow label="Woreda"   value={record.woreda} />
                  <InfoRow label="Kebele"   value={record.kebele} />
                  <InfoRow label="House No" value={record.houseNo} />
                  <InfoRow label="Flat No"  value={record.flatNo} />
                  <InfoRow label="Residence" value={record.residence} />
                </div>
              </div>
              <Separator />

              {/* ID */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Identification</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Document"       value={record.documentName} />
                  <InfoRow label="Legal ID No."   value={record.legalIdNumber}   copyable />
                  <InfoRow label="Name on ID"     value={record.nameOnID} />
                  <InfoRow label="Issue Authority" value={record.issueAuthority} />
                  <InfoRow label="Issue Date"     value={record.issueDate} />
                  <InfoRow label="Expiry Date"    value={record.expirationDate} />
                </div>
              </div>
              <Separator />

              {/* Banking */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Contact &amp; Banking</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Mobile"          value={record.mobilePhoneNumbers} copyable />
                  <InfoRow label="Residential Ph." value={record.phoneNumbersRes}    copyable />
                  <InfoRow label="Language"        value={record.language} />
                  <InfoRow label="Sector"          value={record.sector} />
                  <InfoRow label="Industry"        value={record.industry} />
                  <InfoRow label="Acct. Officer"   value={record.accountOfficer} />
                  <InfoRow label="Customer Type"   value={record.customerType} />
                  <InfoRow label="Customer Status" value={record.customerStatus} />
                  <InfoRow label="Target"          value={record.target} />
                  <InfoRow label="Secure Message"  value={record.secureMessage} />
                </div>
              </div>
              <Separator />

              {/* Employment */}
              {(record.occupation || record.employersName || record.netMonthlyIn) && (
                <>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Employment</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <InfoRow label="Occupation"  value={record.occupation} />
                      <InfoRow label="Employer"    value={record.employersName} />
                      <InfoRow label="Monthly Inc." value={record.netMonthlyIn ? `ETB ${record.netMonthlyIn}` : null} />
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Forward error */}
              {record.forwardError && !record.forwardedAt && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" /> T24 Core Ingestion Failed
                    </p>
                    <div className="text-[11px] font-mono bg-background/50 p-2.5 rounded border border-destructive/20 text-muted-foreground break-all whitespace-pre-wrap">
                      {record.forwardError}
                    </div>
                  </div>
                  {canReview && (
                    <Button
                      onClick={handleRetry}
                      disabled={!!actionInProgress}
                      size="sm"
                      className="shadow-sm"
                    >
                      {actionInProgress === 'RETRY' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                      Retry Core Sync
                    </Button>
                  )}
                </div>
              )}

              {/* Stage 1 (Maker) Review Note */}
              {(record as any).makerReviewedAt && (
                <div className="rounded-md border border-blue-200/50 bg-blue-50/30 dark:bg-blue-900/10 p-3">
                  <p className="text-xs font-bold mb-1 text-blue-700 dark:text-blue-400">Stage 1: Maker Approval</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{(record as any).makerReviewNote || 'Approved at Maker level'}</p>
                  {(record as any).makerReviewedBy && (
                    <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
                      — Verified by {(record as any).makerReviewedBy.name} on {format(new Date((record as any).makerReviewedAt), 'dd MMM yyyy HH:mm')}
                    </p>
                  )}
                </div>
              )}

              {/* Final Review (Checker) Note */}
              {record.reviewNote && (
                <div className="rounded-md border border-emerald-200/50 bg-emerald-50/30 dark:bg-emerald-900/10 p-3">
                  <p className="text-xs font-bold mb-1 text-emerald-700 dark:text-emerald-400">Stage 2: Final Authorization</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{record.reviewNote}</p>
                  {record.reviewedBy && (
                    <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
                      — Authorized by {record.reviewedBy.name}{record.reviewedAt && ` on ${format(new Date(record.reviewedAt), 'dd MMM yyyy HH:mm')}`}
                    </p>
                  )}
                </div>
              )}

              {/* Audit log */}
              {record.auditLogs && record.auditLogs.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 border-b border-primary/10 pb-1">Automated Audit Trail</h3>
                  <AuditTimeline logs={record.auditLogs} />
                </div>
              )}

              {/* Reviewer actions (Dual Stage) */}
              {canReview && (['PENDING', 'MAKER_APPROVED'].includes(record.approvalStatus as string)) && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">
                      {((record.approvalStatus as string) === 'PENDING') ? 'Stage 1: Maker Approval' : 'Stage 2: Checker Authorization'}
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Dual Control Active</Badge>
                  </div>
                  
                  <Textarea
                    placeholder={((record.approvalStatus as string) === 'PENDING') 
                      ? "Comments for first-level review..." 
                      : "Final authorization comments for T24 ingestion..."}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={3}
                    className="text-sm bg-background/50 border-primary/20 focus:border-primary transition-all duration-200"
                  />
                  
                  <div className="flex gap-3 pt-1">
                    <Button
                      onClick={() => handleDecision('APPROVED')}
                      disabled={!!actionInProgress}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {actionInProgress === 'APPROVE'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> 
                            {(record.approvalStatus as string) === 'PENDING' ? 'Approve (Stage 1)' : 'Authorize & Ingest (T24)'}
                          </>
                        )
                      }
                    </Button>
                    <Button
                      onClick={() => handleDecision('REJECTED')}
                      disabled={!!actionInProgress}
                      variant="destructive"
                      className="flex-1 shadow-lg shadow-destructive/20 disabled:opacity-50"
                    >
                      {actionInProgress === 'REJECT'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><XCircle className="h-4 w-4 mr-1.5" /> Reject</>}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <p className="text-center text-muted-foreground py-10 italic font-outfit">Detailed record data could not be retrieved.</p>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main review panel ────────────────────────────────────────────────────────
export function CustomerOnboardingReviewPanel({ canReview }: { canReview: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();

  // Initialize from URL or defaults
  const [records, setRecords]           = useState<CustomerOnboarding[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  
  const [page, setPage]                 = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize]         = useState(Number(searchParams.get('pageSize')) || 15);
  const [search, setSearch]             = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  
  // Debounce search input to avoid excessive server requests
  useEffect(() => {
    const timer = setTimeout(() => {
        setSearch(debouncedSearch);
        setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>((searchParams.get('status') as any) || 'ALL');
  
  const [sortBy, setSortBy]             = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');
  
  const [fromDate, setFromDate]         = useState(searchParams.get('fromDate') || '');
  const [toDate, setToDate]             = useState(searchParams.get('toDate') || '');
  const [gender, setGender]             = useState(searchParams.get('gender') || 'ALL');
  
  const [selectedId, setSelectedId]     = useState<string | null>(searchParams.get('id') || null);
  const [selection, setSelection]       = useState<Map<string, ApprovalStatus>>(new Map());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmBulk, setConfirmBulk]   = useState<{ type: 'APPROVED' | 'REJECTED'; count: number } | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [exportType, setExportType] = useState<'SELECTED' | 'ALL' | null>(null);
  const [exportConfig, setExportConfig] = useState<Set<string>>(new Set(['mnemonic', 'givenName', 'familyName', 'gender', 'approvalStatus', 'legalIdNumber', 'createdAt']));

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('ALL');
    setGender('ALL');
    setFromDate('');
    setToDate('');
    setPage(1);
    setPageSize(15);
    setSortBy('createdAt');
    setSortOrder('desc');
  }, []);

  // Sync state to URL — single direction to avoid loops
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (pageSize !== 15) params.set('pageSize', pageSize.toString());
    if (search) params.set('search', search);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (gender !== 'ALL') params.set('gender', gender);
    if (selectedId) params.set('id', selectedId);
    
    const newUrl = `${pathname}?${params.toString()}`;
    if (window.location.search !== `?${params.toString()}`) {
      router.replace(newUrl, { scroll: false });
    }
  }, [page, pageSize, search, statusFilter, sortBy, sortOrder, fromDate, toDate, gender, selectedId, pathname, router]);

  // Sync state FROM URL when navigating back/forward — only run if URL actually diverges
  useEffect(() => {
    const urlPage = Number(searchParams.get('page')) || 1;
    const urlPageSize = Number(searchParams.get('pageSize')) || 15;
    const urlSearch = searchParams.get('search') || '';
    const urlStatus = (searchParams.get('status') as any) || 'ALL';
    const urlSortBy = searchParams.get('sortBy') || 'createdAt';
    const urlSortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const urlFromDate = searchParams.get('fromDate') || '';
    const urlToDate = searchParams.get('toDate') || '';
    const urlGender = searchParams.get('gender') || 'ALL';
    const urlId = searchParams.get('id') || null;

    if (page !== urlPage) setPage(urlPage);
    if (pageSize !== urlPageSize) setPageSize(urlPageSize);
    if (search !== urlSearch) { setSearch(urlSearch); setDebouncedSearch(urlSearch); }
    if (statusFilter !== urlStatus) setStatusFilter(urlStatus);
    if (sortBy !== urlSortBy) setSortBy(urlSortBy);
    if (sortOrder !== urlSortOrder) setSortOrder(urlSortOrder);
    if (fromDate !== urlFromDate) setFromDate(urlFromDate);
    if (toDate !== urlToDate) setToDate(urlToDate);
    if (gender !== urlGender) setGender(urlGender);
    if (selectedId !== urlId) setSelectedId(urlId);
  }, [searchParams, page, pageSize, search, statusFilter, sortBy, sortOrder, fromDate, toDate, gender, selectedId]);

  const handleExport = async (exportIds?: string[]) => {
    const isBulk = !!exportIds && exportIds.length > 0;
    const msg = isBulk ? `Exporting ${exportIds.length} selected records...` : "Preparing full export (filtered)...";
    const toastId = toast.loading(msg);
    
    try {
      const result = await exportCustomerOnboardings({
        ids: exportIds,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search || undefined,
        sortBy,
        sortOrder,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        gender: gender || undefined,
      });

      if (!result.success || !result.records) {
        toast.error(result.error || "Export failed", { id: toastId });
        return;
      }

      if (result.records.length === 0) {
        toast.info("No records found to export", { id: toastId });
        return;
      }

      const activeColumns = EXPORT_COLUMNS.filter(col => exportConfig.has(col.id));

      const dataToExport = result.records.map((r: any, idx: number) => {
        const row: Record<string, any> = { "#": idx + 1 };
        activeColumns.forEach(col => {
          let val = r[col.id];
          if (col.id === 'submittedBy') val = r.submittedBy?.name || 'System';
          else if (col.id === 'reviewedBy') val = r.reviewedBy?.name || 'N/A';
          else if (['createdAt', 'reviewedAt', 'forwardedAt'].includes(col.id)) {
            val = val ? format(new Date(val), 'yyyy-MM-dd HH:mm') : 'N/A';
          }
          row[col.label] = val || 'N/A';
        });
        return row;
      });

      const csv = Papa.unparse(dataToExport);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `nibtera_export_${isBulk ? 'selected' : 'filtered'}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${result.records.length} records successfully`, { id: toastId });
      setExportType(null);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export process failed", { id: toastId });
    }
  };

  const requestRef = React.useRef(0);

  const load = useCallback(async (retryCount = 0) => {
    // Wait for auth to hydrate if it's currently loading
    if (authStatus === 'loading') return;

    const requestId = ++requestRef.current;
    
    // Minimalistic loading state management
    setLoading(true);
    setError(null);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 20000)
    );

    try {
      const result = await Promise.race([
        listCustomerOnboardings({
          status:   statusFilter === 'ALL' ? undefined : statusFilter,
          page,
          pageSize,
          search:   search || undefined,
          sortBy,
          sortOrder,
          fromDate: fromDate || undefined,
          toDate:   toDate || undefined,
          gender:   gender || undefined,
        }),
        timeoutPromise
      ]) as any;

      // Drop stale results
      if (requestId !== requestRef.current) return;

      if (result.success) {
        setRecords(result.records);
        setTotal(result.total);
      } else {
        if (retryCount < 2) {
          console.log(`Retrying list load... (${retryCount + 1})`);
          setTimeout(() => load(retryCount + 1), 1000);
          return;
        }
        setError(result.error || "Failed to fetch records.");
        toast.error(result.error || "Failed to fetch records.");
      }
    } catch (err: any) {
      if (requestId !== requestRef.current) return;
      if (retryCount < 2) {
        console.log(`Retrying list load after error... (${retryCount + 1})`);
        setTimeout(() => load(retryCount + 1), 1000);
        return;
      }
      console.error('[load-error]', err);
      const msg = err.message === 'TIMEOUT' ? "The request timed out." : "A network error occurred.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [authStatus, statusFilter, page, pageSize, search, sortBy, sortOrder, fromDate, toDate, gender]);

  // Use a targeted effect for loading — avoids re-running on URL sync triggers if state hasn't changed.
  useEffect(() => {
    load();
  }, [load]);



  // Stats
  const stats = [
    { label: 'Total',    count: total, icon: FileText,     color: 'text-blue-500'   },
    { label: 'Pending',  count: 0,     icon: Clock,        color: 'text-amber-500'  },
    { label: 'Approved', count: 0,     icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Rejected', count: 0,     icon: XCircle,      color: 'text-red-500'    },
  ];


  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search mnemonic, name…"
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as ApprovalStatus | 'ALL'); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          variant="outline" 
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
          className={cn("gap-2", showAdvancedFilters && "bg-primary/10 border-primary/20 text-primary")}
        >
          <Filter className="h-4 w-4" /> 
          {showAdvancedFilters ? 'Hide Filters' : 'More Filters'}
        </Button>

        <Button 
          variant="outline" 
          onClick={() => setExportType('ALL')} 
          className="gap-2 border-emerald-500/20 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export All
        </Button>

        <Button 
          variant="outline" 
          onClick={resetFilters} 
          className="gap-2 text-muted-foreground hover:text-foreground"
          title="Clear all filters and search"
        >
          <RotateCcw className="h-4 w-4" />
          Clear
        </Button>

        <Button variant="outline" size="icon" onClick={load} title="Refresh">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-4 border-dashed bg-muted/20 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Gender
                </label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="All Genders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Genders</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Ingested From
                </label>
                <Input 
                   type="date" 
                   value={fromDate} 
                   onChange={(e) => { setFromDate(e.target.value); setPage(1); }} 
                   className="h-9 bg-background" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Ingested To
                </label>
                <Input 
                   type="date" 
                   value={toDate} 
                   onChange={(e) => { setToDate(e.target.value); setPage(1); }} 
                   className="h-9 bg-background" 
                />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <Card className="border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 w-10">
                  <Checkbox 
                    checked={records.length > 0 && records.every(r => selection.has(r.id))}
                    onCheckedChange={(checked) => {
                      const next = new Map(selection);
                      if (checked) {
                        records.forEach(r => next.set(r.id, r.approvalStatus));
                      } else {
                        records.forEach(r => next.delete(r.id));
                      }
                      setSelection(next);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-[10px] uppercase w-12 text-center">#</th>
                <th 
                  className="px-4 py-3 text-left font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors group"
                  onClick={() => {
                    if (sortBy === 'mnemonic') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('mnemonic'); setSortOrder('asc'); }
                    setPage(1);
                  }}
                >
                  <div className="flex items-center gap-1">
                    Mnemonic
                    {sortBy === 'mnemonic' 
                      ? (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                      : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    }
                  </div>
                </th>
                <th 
                   className="px-4 py-3 text-left font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors group"
                   onClick={() => {
                     if (sortBy === 'givenName') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                     else { setSortBy('givenName'); setSortOrder('asc'); }
                     setPage(1);
                   }}
                >
                  <div className="flex items-center gap-1">
                    Payload (Customer)
                    {sortBy === 'givenName' 
                      ? (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                      : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    }
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">Source / Actor</th>
                <th 
                   className="px-4 py-3 text-left font-medium text-muted-foreground text-xs hidden sm:table-cell cursor-pointer hover:text-foreground transition-colors group"
                   onClick={() => {
                     if (sortBy === 'createdAt') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                     else { setSortBy('createdAt'); setSortOrder('asc'); }
                     setPage(1);
                   }}
                >
                  <div className="flex items-center gap-1">
                    Ingested At
                    {sortBy === 'createdAt' 
                      ? (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                      : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    }
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Pipeline Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs hidden lg:table-cell">Forwarded (T24)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="h-20 w-20 rounded-2xl bg-destructive/5 flex items-center justify-center border border-dashed border-destructive/20 shadow-sm">
                        <AlertTriangle className="h-10 w-10 text-destructive/40" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-bold text-foreground tracking-tight">Load Interrupted</h3>
                        <p className="text-sm text-muted-foreground max-w-[320px] mx-auto leading-relaxed">
                          {error}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={load}
                        className="mt-2 h-9 font-semibold"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Request
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      {/* Static, high-performance illustration */}
                      <div className="relative">
                        <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center border border-dashed border-border shadow-sm">
                          <FileText className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background border border-border shadow-sm flex items-center justify-center">
                          <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-bold text-foreground tracking-tight">No records found</h3>
                        <p className="text-sm text-muted-foreground max-w-[320px] mx-auto leading-relaxed">
                          We couldn't find any onboarding requests matching your current search criteria or filters.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={resetFilters}
                        className="mt-2 h-9 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors font-semibold"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset view
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((rec, index) => (
                  <DataRow 
                    key={rec.id} 
                    rec={rec} 
                    index={index} 
                    page={page} 
                    pageSize={pageSize} 
                    isSelected={selection.has(rec.id)}
                    onToggle={(checked: boolean) => {
                        const next = new Map(selection);
                        if (checked) next.set(rec.id, rec.approvalStatus);
                        else next.delete(rec.id);
                        setSelection(next);
                    }}
                    onView={() => setSelectedId(rec.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Show</span>
            <Select 
                value={pageSize.toString()} 
                onValueChange={(v) => { setPageSize(parseInt(v, 10)); setPage(1); }}
            >
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 50, 100].map(size => (
                  <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">records</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : '0 records'}
          </p>
        </div>
        <div className="flex gap-1 items-center">
            <div className="text-xs text-muted-foreground mr-2">
                Page {page} of {totalPages}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
        </div>
        </div>
      </Card>

      {/* Bulk Confirmation Dialog */}
      <AlertDialog open={!!confirmBulk} onOpenChange={(open) => !open && setConfirmBulk(null)}>
        <AlertDialogContent className="border-primary/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              {confirmBulk?.type === 'APPROVED' ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Confirm Bulk Approval</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" /> Confirm Bulk Rejection</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-2">
                You are about to <strong>{confirmBulk?.type.toLowerCase()}</strong> {confirmBulk?.count} onboarding requests. 
                This action will trigger automated core banking forwarding and cannot be easily undone.
                <br /><br />
                Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel disabled={bulkProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkProcessing}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmBulk) return;
                setBulkProcessing(true);
                const result = await bulkReviewCustomerOnboarding({ 
                   ids: Array.from(selection.keys()), 
                   decision: confirmBulk.type 
                });
                if (result.success) {
                   toast.success(`Successfully ${confirmBulk.type.toLowerCase()} ${result.count} records`);
                   setConfirmBulk(null);
                   setSelection(new Map()); // Clear selection after bulk
                   load();
                } else {
                   toast.error(result.error);
                }
                setBulkProcessing(false);
              }}
              className={cn(
                "min-w-32",
                confirmBulk?.type === 'APPROVED' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"
              )}
            >
              {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Yes, ${confirmBulk?.type.toLowerCase()}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selection.size > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-background border border-primary/20 shadow-2xl rounded-full flex items-center gap-6"
          >
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary">{selection.size} Selected</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Bulk Operations</span>
            </div>
            
            <div className="h-8 w-px bg-border" />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setExportType('SELECTED')}
              >
                <Download className="h-4 w-4" /> Export
              </Button>

              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700 h-9"
                disabled={bulkProcessing || Array.from(selection.values()).some(s => s === 'APPROVED')}
                onClick={() => setConfirmBulk({ type: 'APPROVED', count: selection.size })}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
              </Button>
              
              <Button 
                size="sm" 
                variant="destructive"
                className="h-9"
                disabled={bulkProcessing || Array.from(selection.values()).some(s => s === 'REJECTED')}
                onClick={() => setConfirmBulk({ type: 'REJECTED', count: selection.size })}
              >
                <XCircle className="h-4 w-4 mr-1.5" /> Reject
              </Button>
              
              <Button size="sm" variant="ghost" onClick={() => setSelection(new Map())} className="h-9">
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail dialog */}
      <AnimatePresence>
        {selectedId && (
          <RecordDetailDialog
            key={selectedId}
            recordId={selectedId}
            canReview={canReview}
            onClose={() => setSelectedId(null)}
            onRefresh={load}
          />
        )}
      </AnimatePresence>

      {/* Export Dialog */}
      <Dialog open={exportType !== null} onOpenChange={(open) => !open && setExportType(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Export Configuration</DialogTitle>
            <DialogDescription>
              Select the columns you want to include in your CSV report for {exportType === 'SELECTED' ? `the ${selection.size} selected records` : 'all filtered records'}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {['Identity', 'Address', 'Contact', 'Legal', 'Banking', 'Audit'].map(cat => (
              <div key={cat} className="space-y-3">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-primary" /> {cat} Fields
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {EXPORT_COLUMNS.filter(c => c.category === cat).map(col => (
                    <div key={col.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`col-${col.id}`}
                        checked={exportConfig.has(col.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(exportConfig);
                          if (checked) next.add(col.id); else next.delete(col.id);
                          setExportConfig(next);
                        }}
                      />
                      <label 
                        htmlFor={`col-${col.id}`} 
                        className="text-xs font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-4 border-t">
            <div className="flex flex-1 items-center gap-2">
               <Button variant="ghost" size="sm" onClick={() => setExportConfig(new Set(EXPORT_COLUMNS.map(c => c.id)))}>Select All</Button>
               <Button variant="ghost" size="sm" onClick={() => setExportConfig(new Set(['mnemonic', 'givenName', 'familyName', 'gender', 'approvalStatus', 'legalIdNumber', 'createdAt']))}>Reset Default</Button>
            </div>
            <Button variant="ghost" onClick={() => setExportType(null)}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]" 
              onClick={() => handleExport(exportType === 'SELECTED' ? Array.from(selection.keys()) : [])}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Generate CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EXPORT_COLUMNS = [
  { id: 'mnemonic', label: 'Mnemonic', category: 'Identity' },
  { id: 'shortName', label: 'Short Name', category: 'Identity' },
  { id: 'fullName1', label: 'Full Name 1', category: 'Identity' },
  { id: 'fullName2', label: 'Full Name 2', category: 'Identity' },
  { id: 'title', label: 'Title', category: 'Identity' },
  { id: 'givenName', label: 'Given Name', category: 'Identity' },
  { id: 'familyName', label: 'Family Name', category: 'Identity' },
  { id: 'gender', label: 'Gender', category: 'Identity' },
  { id: 'dateOfBirth', label: 'Date of Birth', category: 'Identity' },
  { id: 'maritalStatus', label: 'Marital Status', category: 'Identity' },
  { id: 'motherName', label: 'Mother Name', category: 'Identity' },
  { id: 'nationality', label: 'Nationality', category: 'Identity' },
  { id: 'nationalIDNumber', label: 'National ID', category: 'Identity' },
  
  { id: 'street', label: 'Street', category: 'Address' },
  { id: 'townCity', label: 'Town/City', category: 'Address' },
  { id: 'country', label: 'Country', category: 'Address' },
  { id: 'region', label: 'Region', category: 'Address' },
  { id: 'houseNo', label: 'House No', category: 'Address' },
  { id: 'flatNo', label: 'Flat No', category: 'Address' },
  { id: 'subcity', label: 'Subcity', category: 'Address' },
  
  { id: 'phoneNumbersRes', label: 'Phone (Res)', category: 'Contact' },
  { id: 'mobilePhoneNumbers', label: 'Mobile', category: 'Contact' },
  { id: 'language', label: 'Language', category: 'Contact' },
  
  { id: 'legalIdNumber', label: 'Legal ID', category: 'Legal' },
  { id: 'documentName', label: 'Document Name', category: 'Legal' },
  { id: 'issueAuthority', label: 'Issue Authority', category: 'Legal' },
  { id: 'issueDate', label: 'Issue Date', category: 'Legal' },
  { id: 'expirationDate', label: 'Expiration Date', category: 'Legal' },
  
  { id: 'sector', label: 'Sector', category: 'Banking' },
  { id: 'accountOfficer', label: 'Account Officer', category: 'Banking' },
  { id: 'industry', label: 'Industry', category: 'Banking' },
  { id: 'target', label: 'Target', category: 'Banking' },
  { id: 'customerStatus', label: 'Customer Status', category: 'Banking' },
  { id: 'residence', label: 'Residence', category: 'Banking' },
  { id: 'customerType', label: 'Customer Type', category: 'Banking' },
  
  { id: 'approvalStatus', label: 'Approval Status', category: 'Audit' },
  { id: 'submittedBy', label: 'Submitted By', category: 'Audit' },
  { id: 'reviewedBy', label: 'Reviewed By', category: 'Audit' },
  { id: 'createdAt', label: 'Ingested At', category: 'Audit' },
  { id: 'reviewedAt', label: 'Reviewed At', category: 'Audit' },
  { id: 'forwardedAt', label: 'Forwarded At', category: 'Audit' },
];
