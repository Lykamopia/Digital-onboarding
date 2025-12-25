
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getLoggedInUser } from '@/app/actions/memo';
import type { Permission, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatePresence } from 'framer-motion';
import { AnimatedContent } from '@/components/animated-content';

const navItemsConfig = [
  { value: '/dashboard/admin/divisions', label: 'Divisions', permission: 'manage_divisions' },
  { value: '/dashboard/admin/departments', label: 'Departments', permission: 'manage_departments' },
  { value: '/dashboard/admin/offices', label: 'Offices', permission: 'manage_offices' },
  { value: '/dashboard/admin/users', label: 'Users', permission: 'manage_users' },
  { value: '/dashboard/admin/roles', label: 'Role Management', permission: 'manage_roles' },
  { value: '/dashboard/admin/archive', label: 'Archive', permission: 'manage_archive' },
];

function useAdminNavigation(user: (User & { role: { permissions: Permission[] } }) | null) {
  const pathname = usePathname();
  const router = useRouter();

  const accessibleNavItems = useMemo(() => {
    if (!user) return [];
    return navItemsConfig.filter(item => user.role.permissions.includes(item.permission as Permission));
  }, [user]);

  const activeTab = useMemo(() => {
    // Find the best-matching tab for the current path
    return accessibleNavItems.find(item => pathname.startsWith(item.value))?.value || null;
  }, [accessibleNavItems, pathname]);

  useEffect(() => {
    if (user && accessibleNavItems.length > 0) {
      const currentTabIsValid = accessibleNavItems.some(item => pathname.startsWith(item.value));
      // If the current URL doesn't match any accessible tab, redirect to the first accessible one.
      if (!currentTabIsValid) {
        router.replace(accessibleNavItems[0].value);
      }
    } else if (user && accessibleNavItems.length === 0) {
      // If user has no admin permissions, redirect away from admin area
      if (pathname.startsWith('/dashboard/admin')) {
          router.replace('/dashboard');
      }
    }
  }, [user, pathname, accessibleNavItems, router]);

  return { activeTab, accessibleNavItems };
}

function AdminPageContent({ user, activeTab, accessibleNavItems, handleTabChange, children }: {
    user: (User & { role: { permissions: Permission[] } }) | null;
    activeTab: string | null;
    accessibleNavItems: { value: string; label: string; permission: string; }[];
    handleTabChange: (value: string) => void;
    children: React.ReactNode;
}) {
    if (!user) {
        return <Skeleton className="h-[200px] w-full" />;
    }

    if (accessibleNavItems.length === 0) {
        // This state is handled by the redirect in the hook, but as a fallback, show nothing.
        return null;
    }
    
    // While redirecting from an invalid tab, show a loader.
    if (!activeTab) {
        return <Skeleton className="h-[200px] w-full" />;
    }

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                {accessibleNavItems.map((item) => (
                <TabsTrigger 
                    key={item.value} 
                    value={item.value}
                    className={cn(
                        "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                    )}
                >
                    {item.label}
                </TabsTrigger>
                ))}
            </TabsList>
            <div className="mt-4">
                <AnimatePresence mode="wait">
                    <AnimatedContent key={activeTab}>
                        {children}
                    </AnimatedContent>
                </AnimatePresence>
            </div>
        </Tabs>
    );
}


const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<(User & { role: { permissions: Permission[] } }) | null>(null);
  const [loading, setLoading] = useState(true);

  const { activeTab, accessibleNavItems } = useAdminNavigation(user);

  useEffect(() => {
    getLoggedInUser().then(userData => {
      setUser(userData);
      setLoading(false);
    });
  }, []);
  
  const handleTabChange = (value: string) => {
    router.push(value);
  };
  
  return (
    <Card>
       <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
            <Skeleton className="h-[200px] w-full" />
        ) : (
            <AdminPageContent
                user={user}
                activeTab={activeTab}
                accessibleNavItems={accessibleNavItems}
                handleTabChange={handleTabChange}
            >
                {children}
            </AdminPageContent>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminLayout;