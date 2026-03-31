'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  CheckCircle2, XCircle, RefreshCw, Eye, ChevronLeft, ChevronRight,
  Search, Clock, Building2, User, FileText, Loader2, AlertTriangle,
  Send, Filter, RotateCcw, ArrowRightLeft, ArrowUpDown, ChevronUp, ChevronDown, Calendar,
  Download, FileSpreadsheet,
} from 'lucide-react';
import Papa from 'papaparse';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

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
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline'; className: string }> = {
    PENDING:  { label: 'Pending',  variant: 'secondary',  className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: 'Approved', variant: 'default',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED: { label: 'Rejected', variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  };
  const cfg = map[status];
  return <Badge variant="outline" className={cn('font-medium text-xs', cfg.className)}>{cfg.label}</Badge>;
}

// ─── Audit timeline ───────────────────────────────────────────────────────────
function AuditTimeline({ logs }: { logs: CustomerOnboardingAuditLog[] }) {
  const iconMap: Record<string, React.ReactNode> = {
    SUBMITTED:    <Clock className="h-3.5 w-3.5 text-blue-500" />,
    APPROVED:     <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    REJECTED:     <XCircle className="h-3.5 w-3.5 text-red-500" />,
    FORWARDED:    <Send className="h-3.5 w-3.5 text-primary" />,
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
  const [record, setRecord] = useState<CustomerOnboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [actionInProgress, setActionInProgress] = useState<'APPROVE' | 'REJECT' | 'RETRY' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getCustomerOnboarding(recordId);
    if (result.success) setRecord(result.record as CustomerOnboarding);
    setLoading(false);
  }, [recordId]);

  useEffect(() => { load(); }, [load]);

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
      load(); // Reload to fetch the updated error note
    }
    setActionInProgress(null);
  }

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value}</p>
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
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : record ? (
            <div className="space-y-6 pb-4">
              {/* Status bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={record.approvalStatus} />
                {record.forwardedAt && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                    <Send className="h-3 w-3 mr-1" /> Forwarded {format(new Date(record.forwardedAt), 'dd MMM yyyy')}
                  </Badge>
                )}
                {record.forwardError && !record.forwardedAt && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Forward failed
                  </Badge>
                )}
              </div>

              {/* Personal */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Payload Information (Ingested)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="Mnemonic"       value={record.mnemonic} />
                  <InfoRow label="Title"           value={record.title} />
                  <InfoRow label="Given Name"      value={record.givenName} />
                  <InfoRow label="Family Name"     value={record.familyName} />
                  <InfoRow label="Full Name"       value={record.fullName1} />
                  <InfoRow label="Short Name"      value={record.shortName} />
                  <InfoRow label="Gender"          value={record.gender} />
                  <InfoRow label="Date of Birth"   value={record.dateOfBirth} />
                  <InfoRow label="Marital Status"  value={record.maritalStatus} />
                  <InfoRow label="Nationality"     value={record.nationality} />
                  <InfoRow label="National ID"     value={record.nationalIDNumber} />
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
                  <InfoRow label="Legal ID No."   value={record.legalIdNumber} />
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
                  <InfoRow label="Mobile"          value={record.mobilePhoneNumbers} />
                  <InfoRow label="Residential Ph." value={record.phoneNumbersRes} />
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

              {/* Review note */}
              {record.reviewNote && (
                <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs font-bold mb-1 text-foreground">Reviewer Note</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{record.reviewNote}</p>
                  {record.reviewedBy && (
                    <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
                      — Reviewed by {record.reviewedBy.name}{record.reviewedAt && ` on ${format(new Date(record.reviewedAt), 'dd MMM yyyy HH:mm')}`}
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

              {/* Reviewer actions */}
              {canReview && record.approvalStatus === 'PENDING' && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-primary">Review Decision <span className="text-destructive">*</span></h3>
                  <Textarea
                    placeholder="Provide context for approval or rejection (required)..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={3}
                    className="text-sm bg-background/50 border-primary/20 focus:border-primary transition-all duration-200"
                  />
                  <div className="flex gap-3 pt-1">
                    <Button
                      onClick={() => handleDecision('APPROVED')}
                      disabled={!!actionInProgress || reviewNote.trim() === ''}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionInProgress === 'APPROVE'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve Submission</>}
                    </Button>
                    <Button
                      onClick={() => handleDecision('REJECTED')}
                      disabled={!!actionInProgress || reviewNote.trim() === ''}
                      variant="destructive"
                      className="flex-1 shadow-lg shadow-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-center text-muted-foreground py-10 italic">Detailed record data could not be retrieved.</p>
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

  // Initialize from URL or defaults
  const [records, setRecords]           = useState<CustomerOnboarding[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  
  const [page, setPage]                 = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize]         = useState(Number(searchParams.get('pageSize')) || 15);
  const [search, setSearch]             = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>((searchParams.get('status') as any) || 'ALL');
  
  const [sortBy, setSortBy]             = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder]       = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'desc');
  
  const [fromDate, setFromDate]         = useState(searchParams.get('fromDate') || '');
  const [toDate, setToDate]             = useState(searchParams.get('toDate') || '');
  const [gender, setGender]             = useState(searchParams.get('gender') || 'ALL');
  
  const [selectedId, setSelectedId]     = useState<string | null>(null);
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

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set('page', page.toString()); else params.delete('page');
    if (pageSize !== 15) params.set('pageSize', pageSize.toString()); else params.delete('pageSize');
    if (search) params.set('search', search); else params.delete('search');
    if (statusFilter !== 'ALL') params.set('status', statusFilter); else params.delete('status');
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy); else params.delete('sortBy');
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder); else params.delete('sortOrder');
    if (fromDate) params.set('fromDate', fromDate); else params.delete('fromDate');
    if (toDate) params.set('toDate', toDate); else params.delete('toDate');
    if (gender !== 'ALL') params.set('gender', gender); else params.delete('gender');
    
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [page, pageSize, search, statusFilter, sortBy, sortOrder, fromDate, toDate, gender, pathname, router, searchParams]);

  // Sync state FROM URL when navigating back/forward
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

    if (page !== urlPage) setPage(urlPage);
    if (pageSize !== urlPageSize) setPageSize(urlPageSize);
    if (search !== urlSearch) setSearch(urlSearch);
    if (statusFilter !== urlStatus) setStatusFilter(urlStatus);
    if (sortBy !== urlSortBy) setSortBy(urlSortBy);
    if (sortOrder !== urlSortOrder) setSortOrder(urlSortOrder);
    if (fromDate !== urlFromDate) setFromDate(urlFromDate);
    if (toDate !== urlToDate) setToDate(urlToDate);
    if (gender !== urlGender) setGender(urlGender);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listCustomerOnboardings({
      status:   statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      pageSize,
      search:   search || undefined,
      sortBy,
      sortOrder,
      fromDate: fromDate || undefined,
      toDate:   toDate || undefined,
      gender:   gender || undefined,
    });
    if (result.success) {
      setRecords(result.records);
      setTotal(result.total);
    }
    setLoading(false);
  }, [statusFilter, page, pageSize, search, sortBy, sortOrder, fromDate, toDate, gender]);

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

  const loadRef = React.useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  
  useEffect(() => { load(); }, [load]);

  // Handle real-time updates via WebSocket
  useEffect(() => {
    // Determine WS URL (middleware default port is 3011)
    const socketPort = process.env.NEXT_PUBLIC_WEBSOCKET_PORT || '3011';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socketUrl = `${protocol}://${window.location.hostname}:${socketPort}`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        console.log(`[WS] Connecting to ${socketUrl}...`);
        ws = new WebSocket(socketUrl);
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // We refresh if any record is submitted or reviewed
            if (['SUBMITTED', 'REVIEWED', 'FORWARDED', 'FORWARD_FAILED'].includes(data.type)) {
              if (data.type === 'SUBMITTED') {
                toast.info('New onboarding request received', {
                  id: `submitted-${data.id}`,
                  description: `Mnemonic: ${data.mnemonic || 'Unknown'}`,
                });
              }
              loadRef.current(); // Refresh the list with the latest filter state
            }
          } catch (e) {
            console.error('[WS] Message parse error:', e);
          }
        };

        ws.onclose = (e) => {
          console.log('[WS] Disconnected. Reconnecting in 5s...', e.reason);
          reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onerror = (err) => {
          console.error('[WS] Connection error:', err);
          ws?.close();
        };
      } catch (err) {
        console.error('[WS] Setup error:', err);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

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
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No records found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <motion.tr
                    key={rec.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                        "border-b hover:bg-muted/30 transition-colors",
                        selection.has(rec.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <Checkbox 
                        checked={selection.has(rec.id)}
                        onCheckedChange={(checked) => {
                          const next = new Map(selection);
                          if (checked) next.set(rec.id, rec.approvalStatus);
                          else next.delete(rec.id);
                          setSelection(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground font-mono text-center">
                        {(page - 1) * pageSize + records.indexOf(rec) + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{rec.mnemonic}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-xs">{rec.givenName} {rec.familyName}</div>
                      <div className="text-muted-foreground text-[11px]">{rec.shortName}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {rec.submittedBy?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {format(new Date(rec.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rec.approvalStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs hidden lg:table-cell">
                      {rec.forwardedAt
                        ? <span className="text-emerald-600 dark:text-emerald-400">{format(new Date(rec.forwardedAt), 'dd MMM yyyy')}</span>
                        : rec.forwardError
                          ? <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Failed</span>
                          : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedId(rec.id)} className="h-7 px-2">
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </td>
                  </motion.tr>
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
