
import { getLoggedInUser } from '@/app/actions/memo';
import { redirect } from 'next/navigation';
import { navItemsConfig } from './config';
import type { Permission, LoggedInUser } from '@/lib/types';
import AdminLayoutClient from './admin-layout-client';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getLoggedInUser();

    if (!user || user.actingUser) {
        redirect('/dashboard/access-denied');
    }

    const userPermissions = user.role?.permissions?.split(',') || [];
    const hasAdminAccess = navItemsConfig.some(item => 
        userPermissions.includes(item.permission as Permission)
    );

    if (!hasAdminAccess) {
        redirect('/dashboard/access-denied');
    }

    return <AdminLayoutClient user={user}>{children}</AdminLayoutClient>;
}
