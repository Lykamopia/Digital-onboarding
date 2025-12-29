
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function FavoritesPage() {
    const user = await getLoggedInUser();
    const initialMemos = await getDashboardData('favorites', '', '', {});

    return <MainDashboard 
        tab="favorites"
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
