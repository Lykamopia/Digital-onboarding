
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    // Redirect to the new professional dashboard landing page
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
