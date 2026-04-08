import { redirect } from 'next/navigation';
import { getLoggedInUser } from '@/app/actions/memo';
import { CustomerOnboardingReviewPanel } from './review-client';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ExportButton } from '@/components/export-button';

export const metadata = {
  title: 'Customer Onboarding Review | NibTera Onboarding',
  description: 'Review and approve customer onboarding submissions.',
};

export default async function CustomerOnboardingReviewPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams;
  const user = await getLoggedInUser();
  if (!user) redirect('/login');

  const permissions = (user.role?.permissions || '').split(',').map(p => p.trim());
  const isAdmin = permissions.includes('admin');
  const canApprover = permissions.includes('approver_customer_onboarding') || isAdmin;
  const canVerifier = permissions.includes('verifier_customer_onboarding') || isAdmin;

  if (!canApprover && !canVerifier) redirect('/dashboard/access-denied');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Onboarding Verification &amp; Approval</h1>
            <p className="text-sm text-muted-foreground">
              {(canApprover || canVerifier)
                ? 'Verify, sync, and authorize pending customer onboarding submissions'
                : 'Track the status of your submissions'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
              <ShieldCheck className="h-3 w-3" /> Admin Access
            </Badge>
          )}
          {canApprover && !isAdmin && (
            <Badge variant="default" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Approver Access
            </Badge>
          )}
          {canVerifier && !isAdmin && (
            <Badge variant="secondary" className="gap-1">
              <Users2 className="h-3 w-3" /> Verifier Access
            </Badge>
          )}
          <ExportButton />
        </div>
      </div>

      <CustomerOnboardingReviewPanel canReview={canApprover} canMaker={canVerifier} />
    </div>
  );
}
