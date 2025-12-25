
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function ArchivePage() {
    const user = await getLoggedInUser();
    const initialMemos = await getDashboardData('archive', '', '', {});

    return <MainDashboard 
        tab="archive"
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
