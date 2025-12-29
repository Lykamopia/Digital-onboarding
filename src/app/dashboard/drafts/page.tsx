
import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { MemoWithActivity, User } from '@/lib/types';

export default async function DraftsPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const user = await getLoggedInUser();
    const show = typeof searchParams.show === 'string' ? searchParams.show : '';
    const initialMemos = await getDashboardData('drafts', '', '', {}, [], show);

    return <MainDashboard 
        tab="drafts" 
        initialMemos={initialMemos as MemoWithActivity[]} 
        user={user}
    />;
}
