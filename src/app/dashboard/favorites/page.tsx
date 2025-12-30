
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function FavoritesPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const user = await getLoggedInUser();
    if (!user || !user.role?.permissions.includes('view_dashboard')) {
        redirect('/dashboard/access-denied');
    }

    const show = typeof searchParams.show === 'string' ? searchParams.show : '';
    const initialMemos = await getDashboardData('favorites', '', '', { from: undefined, to: undefined }, [], show);

    return <MainDashboard 
        tab="favorites"
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
