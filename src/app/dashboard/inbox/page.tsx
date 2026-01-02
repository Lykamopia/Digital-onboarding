
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function InboxPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const user = await getLoggedInUser();
    const show = searchParams.show as string || '';
    const initialMemos = await getDashboardData('inbox', '', '', {}, [], show);
    
    return <MainDashboard 
        tab="inbox" 
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
