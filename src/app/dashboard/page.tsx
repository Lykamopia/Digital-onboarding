import { redirect } from 'next/navigation';

/**
 * The root dashboard page now acts as a redirect to the Customer Onboarding Status page,
 * as the Memo features have been deprecated and the system is now a dedicated Onboarding Middleware.
 */
export default function DashboardPage() {
  redirect('/dashboard/customer-onboarding');
}
