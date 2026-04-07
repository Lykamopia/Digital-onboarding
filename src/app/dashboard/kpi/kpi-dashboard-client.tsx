'use client';

import { useState, useTransition, useEffect } from 'react';
import { KPIData, KPIFilters, KPIMetadata, getKPIData } from '@/app/actions/kpi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, RefreshCcw, TrendingUp, TrendingDown, Users, CheckCircle2, XCircle, Clock, Send, AlertTriangle, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { listCustomerOnboardings } from '@/app/actions/customer-onboarding';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { OnboardingCharts } from '../customer-onboarding/onboarding-charts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const STATUS_COLORS: Record<string, string> = {
  'APPROVED': '#10b981',
  'REJECTED': '#ef4444',
  'PENDING': '#f59e0b',
  'SYNC_FAILED': '#7f1d1d',
  'DEFAULT': '#6b7280',
};

interface KPIDashboardClientProps {
  initialData: KPIData | null;
  initialError: string | null;
  metadata: KPIMetadata | null;
}

export default function KPIDashboardClient({ initialData, initialError, metadata }: KPIDashboardClientProps) {
  const [data, setData] = useState<KPIData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [filters, setFilters] = useState<KPIFilters>({ dateRange: 'month' });
  const [isPending, startTransition] = useTransition();
  const [showFilters, setShowFilters] = useState(false);
  const [detailedRecords, setDetailedRecords] = useState<any[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);

  const fetchDetailedRecords = async () => {
    setIsRecordsLoading(true);
    try {
      const result = await listCustomerOnboardings({
        status: filters.status,
        fromDate: filters.fromDate?.toISOString(),
        toDate: filters.toDate?.toISOString(),
        pageSize: 10,
      });
      if (result.success) {
        setDetailedRecords(result.records);
      }
    } finally {
      setIsRecordsLoading(false);
    }
  };

  const refreshData = async () => {
    startTransition(async () => {
      const result = await getKPIData(filters);
      if (result.success) {
        setData(result.data);
        setError(null);
        fetchDetailedRecords();
      } else {
        setError(result.error);
      }
    });
  };

  useEffect(() => {
    if (filters.dateRange !== 'custom' || (filters.fromDate && filters.toDate)) {
      refreshData();
    }
  }, [filters]);

  const trendData = data?.trends.labels.map((label, index) => ({
    name: label,
    onboarded: data.trends.onboarded[index],
    rejected: data.trends.rejected[index],
  })) || [];

  const syncPieData = data ? [
    { name: 'Success', value: data.syncStatus.success, color: '#10b981' },
    { name: 'Failure', value: data.syncStatus.failure, color: '#ef4444' },
    { name: 'Pending', value: data.syncStatus.pending, color: '#f59e0b' },
  ] : [];

  const smsPieData = data ? [
    { name: 'Sent', value: data.smsStatus.sent, color: '#10b981' },
    { name: 'Failed', value: data.smsStatus.failed, color: '#ef4444' },
    { name: 'Pending', value: data.smsStatus.pending, color: '#f59e0b' },
  ] : [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-xl font-medium">{error}</p>
        <Button onClick={refreshData}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Time Range:</span>
              <Select 
                value={filters.dateRange} 
                onValueChange={(v: any) => setFilters({ ...filters, dateRange: v })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filters.dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !filters.fromDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fromDate ? format(filters.fromDate, "MMM dd, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={filters.fromDate} onSelect={(d) => setFilters({ ...filters, fromDate: d || undefined })} initialFocus />
                  </PopoverContent>
                </Popover>
                <span>to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !filters.toDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.toDate ? format(filters.toDate, "MMM dd, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={filters.toDate} onSelect={(d) => setFilters({ ...filters, toDate: d || undefined })} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={cn(showFilters && "bg-accent")}>
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
            <Button variant="outline" size="icon" onClick={refreshData} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 pt-4 border-t border-muted-foreground/20">
            <div className="space-y-2">
              <label className="text-xs font-medium">District</label>
              <Select value={filters.districtId || 'all'} onValueChange={(v) => setFilters({ ...filters, districtId: v === 'all' ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {metadata?.districts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Branch</label>
              <Select value={filters.branchId || 'all'} onValueChange={(v) => setFilters({ ...filters, branchId: v === 'all' ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {metadata?.branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Role</label>
              <Select value={filters.role || 'all'} onValueChange={(v) => setFilters({ ...filters, role: v === 'all' ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {metadata?.roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setFilters({ dateRange: 'month' })} className="text-xs">
                Reset Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Onboarded</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.totalOnboarded || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully synced with T24</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.approvalRate.toFixed(1)}%</div>
            <div className="flex items-center text-xs text-green-500">
              <TrendingUp className="mr-1 h-3 w-3" />
              Over processed records
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.averageProcessingTime.toFixed(1)} hrs</div>
            <p className="text-xs text-muted-foreground">From submission to sync</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Failures</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.syncFailed || 0}</div>
            {data && data.summary.syncFailed > 5 && (
              <div className="flex items-center text-xs text-destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Critical alert: High failure rate
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Charts - Use the specialized OnboardingCharts component */}
      {data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Analytics & Demographics</h2>
          </div>
          <OnboardingCharts data={data} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Sync Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle>T24 Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={syncPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {syncPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* SMS Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle>SMS Notification Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={smsPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {smsPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Workload Table/List */}
        <Card>
          <CardHeader>
            <CardTitle>Top Verifier Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.workload.verifiers.map((v, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium">{v.name}</span>
                  </div>
                  <Badge variant="secondary">{v.count} records</Badge>
                </div>
              ))}
              {(!data?.workload.verifiers || data.workload.verifiers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Backlog Alert */}
        <Card className={cn(data && (data.summary.pendingVerification > 20 || data.summary.pendingApproval > 10) ? "border-amber-500 bg-amber-50" : "")}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", data && (data.summary.pendingVerification > 20 || data.summary.pendingApproval > 10) ? "text-amber-500" : "text-muted-foreground")} />
              <CardTitle>Queue Monitoring</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Pending Verification</p>
                <p className="text-2xl font-bold">{data?.summary.pendingVerification || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Pending Approval</p>
                <p className="text-2xl font-bold">{data?.summary.pendingApproval || 0}</p>
              </div>
            </div>
            {data && (data.summary.pendingVerification > 20 || data.summary.pendingApproval > 10) && (
              <p className="mt-4 text-xs text-amber-600 font-medium">
                High backlog detected. Consider reassigning resources to clear the queue.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Resubmission Count</p>
                <p className="text-xl font-bold">{data?.resubmissions || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rejection Rate</p>
                <p className="text-xl font-bold">{data?.summary.rejectionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Records Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Detailed Records</CardTitle>
            <CardDescription>Recent records matching the current filters</CardDescription>
          </div>
          <Link href="/dashboard/customer-onboarding/review">
            <Button variant="ghost" size="sm">
              View All Review Panel
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mnemonic</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRecordsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : detailedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No records found matching these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  detailedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.mnemonic}</TableCell>
                      <TableCell>{record.fullName1}</TableCell>
                      <TableCell>
                        <Badge variant={
                          record.approvalStatus === 'APPROVED' ? 'default' : 
                          record.approvalStatus === 'REJECTED' ? 'destructive' : 
                          'secondary'
                        }>
                          {record.approvalStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.region}</TableCell>
                      <TableCell>{record.submittedBy?.name || 'System'}</TableCell>
                      <TableCell>{format(new Date(record.createdAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
