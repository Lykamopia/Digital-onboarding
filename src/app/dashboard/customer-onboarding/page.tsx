import { redirect } from 'next/navigation';
import { getLoggedInUser } from '@/app/actions/memo';
import { listCustomerOnboardings } from '@/app/actions/customer-onboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users2, ShieldCheck, Activity, ArrowRightLeft, 
  CheckCircle2, Clock, XCircle, Database 
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Onboarding Status | NibTera Onboarding',
  description: 'Monitor automated customer onboarding middleware requests.',
};

export default async function OnboardingStatusPage() {
  const user = await getLoggedInUser();
  if (!user) redirect('/login');

  const permissions = (user.role?.permissions || '').split(',').map(p => p.trim());
  const canApprover = permissions.includes('approver_customer_onboarding');
  const canVerifier = permissions.includes('verifier_customer_onboarding');

  if (!canVerifier && !canApprover) redirect('/dashboard/access-denied');

  // Fetch quick stats
  const [pendingReq, allReq] = await Promise.all([
    listCustomerOnboardings({ status: 'PENDING', pageSize: 1 }),
    listCustomerOnboardings({ pageSize: 10 }),
  ]);

  const stats = [
    { 
      label: 'Pending Verification', 
      value: pendingReq.total || 0, 
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      description: 'Awaiting human intervention (Stage 1)'
    },
    { 
      label: 'Total Ingested', 
      value: allReq.total || 0, 
      icon: <Database className="h-4 w-4 text-blue-500" />,
      description: 'API requests processed'
    },
  ];

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
          {(canApprover || canVerifier) && (
            <Link href="/dashboard/customer-onboarding/review">
              <Button size="sm" className="gap-1">
                <ShieldCheck className="h-4 w-4" /> Open Pipeline
              </Button>
            </Link>
          )}
        </div>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
