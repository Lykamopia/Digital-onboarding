

import { getDashboardData, getLoggedInUser } from '@/app/actions/memo';
import MainDashboard from '../main-dashboard';
import type { DashboardMemo, User } from '@/lib/types';

export default async function ArchivePage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const user = await getLoggedInUser();
    const show = searchParams.show as string || '';
    const initialMemos = await getDashboardData('archive', '', 'all', {}, [], show);

    return <MainDashboard 
        tab="archive"
        initialMemos={initialMemos as DashboardMemo[]} 
        user={user}
    />;
}
