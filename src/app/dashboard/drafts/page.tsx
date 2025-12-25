
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function DraftsPage() {
    const user = await getLoggedInUser();
    const initialMemos = await getDashboardData('drafts', '', '', {});

    return <MainDashboard 
        tab="drafts" 
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
