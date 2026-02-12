
import { getLoggedInUser } from '@/app/actions/memo';
import { redirect } from 'next/navigation';
import { navItemsConfig } from './config';
import type { Permission, LoggedInUser } from '@/lib/types';
import AdminLayoutClient from './admin-layout-client';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getLoggedInUser();

    // The user object itself must be valid, and they can't be in a delegated session.
    // This redirect can stay as it's a fundamental prerequisite.
    if (!user || user.actingUser) {
        redirect('/dashboard/access-denied');
    }

    const userPermissions = user.role?.permissions?.split(',') || [];
    const hasAdminAccess = navItemsConfig.some(item => 
        userPermissions.includes(item.permission as Permission)
    );

    // Instead of redirecting here, we pass the permission flag to the client component.
    // This allows the client component to handle client-side navigation gracefully.
    return <AdminLayoutClient user={user} hasAdminAccess={hasAdminAccess}>{children}</AdminLayoutClient>;
}
