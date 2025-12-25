
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function InboxPage() {
    // Fetch initial data on the server
    const user = await getLoggedInUser();
    const initialMemos = await getDashboardData('inbox', '', '', {});
    
    return <MainDashboard 
        tab="inbox" 
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
