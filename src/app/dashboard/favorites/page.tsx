
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function FavoritesPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const user = await getLoggedInUser();
    const show = typeof searchParams.show === 'string' ? searchParams.show : '';
    const initialMemos = await getDashboardData('favorites', '', '', { from: undefined, to: undefined }, [], show);

    return <MainDashboard 
        tab="favorites"
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
