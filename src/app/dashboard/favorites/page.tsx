
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function FavoritesPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const user = await getLoggedInUser();
    if (!user || !user.role?.permissions.includes('view_dashboard')) {
        redirect('/dashboard/access-denied');
    }

    const show = searchParams.show as string || '';
    const initialMemos = await getDashboardData('favorites', '', 'all', { from: undefined, to: undefined }, [], show, 'all');

    return <MainDashboard 
        tab="favorites"
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
