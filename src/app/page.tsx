import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'NIB Customer Onboarding',
  description: 'Dedicated Customer Onboarding Middleware System',
};

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    // Redirect directly to the Onboarding dashboard
    redirect('/dashboard/customer-onboarding');
  } else {
    redirect('/login');
  }
}
