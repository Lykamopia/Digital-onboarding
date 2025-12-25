
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function SentPage() {
    const user = await getLoggedInUser();
    const initialMemos = await getDashboardData('sent', '', '', {});

    return <MainDashboard 
        tab="sent" 
        initialMemos={initialMemos as MemoWithActivity[]}
        user={user}
    />;
}
