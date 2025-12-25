
import { getLoggedInUser } from '@/app/actions/memo';
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    const user = await getLoggedInUser();

    if (user?.mustChangePassword) {
        redirect('/dashboard/change-password');
    }

    redirect('/dashboard/inbox');
}
