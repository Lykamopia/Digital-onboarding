
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getLoggedInUser } from '@/app/actions/memo';
import type { Permission, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const navItemsConfig = [
  { value: '/dashboard/admin/divisions', label: 'Divisions', permission: 'manage_divisions' },
  { value: '/dashboard/admin/departments', label: 'Departments', permission: 'manage_departments' },
  { value: '/dashboard/admin/offices', label: 'Offices', permission: 'manage_offices' },
  { value: '/dashboard/admin/users', label: 'Users', permission: 'manage_users' },
  { value: '/dashboard/admin/roles', label: 'Role Management', permission: 'manage_roles' },
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


const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<(User & { role: { permissions: Permission[] } }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLoggedInUser().then(userData => {
      setUser(userData);
      setLoading(false);
    });
  }, []);
  
  const { activeTab, accessibleNavItems } = useAdminNavigation(user);

  const handleTabChange = (value: string) => {
    router.push(value);
  };
  
  if (loading || !user) {
    return (
        <Card>
            <CardHeader><CardTitle>Admin Settings</CardTitle></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
        </Card>
    );
  }

  if (accessibleNavItems.length === 0) {
    // This state is handled by the redirect in the hook, but as a fallback, show nothing.
    return null; 
  }
  
  // While redirecting from an invalid tab, show a loader.
  if (!activeTab) {
     return (
        <Card>
            <CardHeader><CardTitle>Admin Settings</CardTitle></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
        </Card>
    );
  }

  return (
    <Card>
       <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
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
              {children}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminLayout;
