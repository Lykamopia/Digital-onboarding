
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if ((session?.user as any)?.mustChangePassword) {
        redirect('/dashboard/change-password');
    }

    redirect('/dashboard/inbox');
}
