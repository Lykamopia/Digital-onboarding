import { redirect } from 'next/navigation';
import { getLoggedInUser } from '@/app/actions/memo';
import { listCustomerOnboardings } from '@/app/actions/customer-onboarding';
import { getKPIData, getKPIMetadata, KPIFilters } from '@/app/actions/kpi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users2, ShieldCheck, Activity, ArrowRightLeft, 
  CheckCircle2, Clock, XCircle, Database, TrendingUp, AlertTriangle, Users, Filter, Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/export-button';
import { StatusFilters } from './status-filters';

import { OnboardingCharts } from './onboarding-charts';

export const metadata = {
  title: 'Onboarding Status | NibTera Onboarding',
  description: 'Monitor automated customer onboarding middleware requests.',
};

export default async function OnboardingStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getLoggedInUser();
  if (!user) redirect('/login');

  const permissions = (user.role?.permissions || '').split(',').map(p => p.trim());
  const isAdmin = permissions.includes('admin');
  const canApprover = permissions.includes('approver_customer_onboarding') || isAdmin;
  const canVerifier = permissions.includes('verifier_customer_onboarding') || isAdmin;
  const canViewer   = permissions.includes('viewer_customer_onboarding');

  if (!canVerifier && !canApprover && !canViewer) redirect('/dashboard/access-denied');

  // Parse filters from search params
  const resolvedSearchParams = await searchParams;
  const filters: KPIFilters = {
    dateRange: (resolvedSearchParams.dateRange as any) || 'month',
    region: resolvedSearchParams.region as string,
    fromDate: resolvedSearchParams.fromDate ? new Date(resolvedSearchParams.fromDate as string) : undefined,
    toDate: resolvedSearchParams.toDate ? new Date(resolvedSearchParams.toDate as string) : undefined,
  };

  // Fetch KPI data and metadata
  const [kpiResult, metadataResult] = await Promise.all([
    getKPIData(filters),
    getKPIMetadata()
  ]);

  const kpi = kpiResult.success ? kpiResult.data : null;
  const metadata = metadataResult.success ? metadataResult.data : null;

  const stats = kpi ? [
    { 
      label: 'Total Onboarded', 
      value: kpi.summary.totalOnboarded, 
      icon: <Users className="h-4 w-4 text-primary" />,
      description: 'Successfully synced with T24',
      subText: null
    },
    { 
      label: 'Backlog Queue', 
      value: kpi.summary.backlog, 
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      description: 'Interactive tasks requiring action',
      subText: (
        <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-1">
          <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px]">V: {kpi.summary.pendingVerification}</Badge>
          <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px]">A: {kpi.summary.pendingApproval}</Badge>
          <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px]">F: {kpi.summary.syncFailed}</Badge>
        </div>
      )
    },
    { 
      label: 'Approval Rate', 
      value: `${kpi.summary.approvalRate.toFixed(1)}%`, 
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      description: 'Success vs Total records',
      subText: (
        <div className="flex items-center text-xs text-green-500 mt-1">
          <TrendingUp className="mr-1 h-3 w-3" />
          {kpi.summary.successRateAfterResubmission.toFixed(1)}% after retry
        </div>
      )
    },
    { 
      label: 'Rejection Analytics', 
      value: kpi.summary.totalRejected, 
      icon: <XCircle className="h-4 w-4 text-destructive" />,
      description: `${kpi.summary.rejectionRate.toFixed(1)}% rejection rate`,
      subText: (
        <div className="text-[10px] text-muted-foreground mt-1">
          {kpi.summary.resubmissionRate.toFixed(1)}% resubmission rate
        </div>
      )
    },
    { 
      label: 'Attempts / Approval', 
      value: kpi.summary.avgAttemptsBeforeApproval.toFixed(2), 
      icon: <Activity className="h-4 w-4 text-indigo-500" />,
      description: 'Avg submissions per success',
      subText: null
    },
    { 
      label: 'Linked Accounts', 
      value: kpi.summary.linkedAccounts, 
      icon: <LinkIcon className="h-4 w-4 text-primary" />,
      description: 'SuperApp linked successfully',
      subText: null
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Middleware Status</h1>
            <p className="text-sm text-muted-foreground">
              Monitoring automated T24 core banking ingestion pipeline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
            <Activity className="h-3 w-3" /> System Active
          </Badge>
          {!canViewer && (
            <ExportButton 
              region={filters.region}
              fromDate={filters.fromDate?.toISOString()}
              toDate={filters.toDate?.toISOString()}
            />
          )}
          {(canApprover || canVerifier || canViewer) && (
            <Link href="/dashboard/customer-onboarding/review">
              <Button size="sm" className="gap-1">
                <ShieldCheck className="h-4 w-4" /> {canViewer && !canApprover && !canVerifier ? 'View Pipeline' : 'Open Pipeline'}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <StatusFilters metadata={metadata} />

      {/* Middleware Role Banner */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6 pb-6">
          <div className="flex gap-4 items-start">
            <div className="p-2 bg-blue-500/10 rounded-full">
              <Database className="h-5 w-5 text-blue-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-blue-700 dark:text-blue-400">Automated Middleware Mode</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This dashboard acts as a secure buffer between external ingestion APIs and the T24 Core Banking system. 
                Data is received via API, validated against schema requirements, and stored as <strong>PENDING</strong> for 
                audit and safety. The workflow follows a <strong>Verifier → Sync → Approver</strong> sequence for maximum security.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              {stat.subText}
            </CardContent>
          </Card>
        ))}
        {!kpi && (
            <div className="col-span-full p-4 text-center text-muted-foreground">
                Unable to load KPI metrics.
            </div>
        )}
      </div>

      {/* Queue Monitoring Alert (From KPI Dashboard) */}
      {kpi && (kpi.summary.pendingVerification > 20 || kpi.summary.pendingApproval > 10) && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">Backlog Warning</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pending Verification</p>
                <p className="text-lg font-bold">{kpi.summary.pendingVerification}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">Pending Approval</p>
                <p className="text-lg font-bold">{kpi.summary.pendingApproval}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-amber-600 font-medium">
              High backlog detected. Please consider reassigning resources to clear the queue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Visual Analytics */}
      {kpi && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">System Performance & Demographics</h2>
          </div>
          <OnboardingCharts data={kpi} />
        </div>
      )}

      {/* Workload Distribution */}
      {kpi && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Verifier Performance</CardTitle>
              <CardDescription className="text-xs">Approved vs Rejected by Stage 1</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpi.workload.verifiers.slice(0, 5).map((v, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.count} total</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${v.count > 0 ? (v.approved / v.count) * 100 : 0}%` }} 
                        />
                        <div 
                          className="h-full bg-destructive" 
                          style={{ width: `${v.count > 0 ? (v.rejected / v.count) * 100 : 0}%` }} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-emerald-600 font-medium">{v.approved} Verified</span>
                      <span className="text-destructive font-medium">{v.rejected} Rejected</span>
                    </div>
                  </div>
                ))}
                {kpi.workload.verifiers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No verifier data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Approver Performance</CardTitle>
              <CardDescription className="text-xs">Final Decisions by Stage 2</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpi.workload.approvers.slice(0, 5).map((v, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.count} total</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${v.count > 0 ? (v.approved / v.count) * 100 : 0}%` }} 
                        />
                        <div 
                          className="h-full bg-amber-500" 
                          style={{ width: `${v.count > 0 ? (v.rejected / v.count) * 100 : 0}%` }} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-emerald-600 font-medium">{v.approved} Approved</span>
                      <span className="text-amber-600 font-medium">{v.rejected} Reverted</span>
                    </div>
                  </div>
                ))}
                {kpi.workload.approvers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No approver data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Status Distribution (One KPI) */}
      {kpi && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Full Pipeline Distribution</CardTitle>
            <CardDescription className="text-xs">Current state of all filtered records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(kpi.summary.statusCounts)
                .filter(([_, count]) => (count as number) > 0)
                .sort(([_, a], [__, b]) => (b as number) - (a as number))
                .map(([status, count]) => (
                <div key={status} className="p-3 rounded-xl border bg-muted/20 flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase truncate">{status.replace(/_/g, ' ')}</span>
                  <span className="text-xl font-bold">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
