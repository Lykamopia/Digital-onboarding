
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getLoggedInUser } from "@/app/actions/memo";
import type { Permission, User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User & { role: { permissions: Permission[] } } | null>(null);

  const navItems = useMemo(() => [
    { value: "/dashboard/admin/divisions", label: "Divisions", permission: "manage_divisions" },
    { value: "/dashboard/admin/departments", label: "Departments", permission: "manage_departments" },
    { value: "/dashboard/admin/offices", label: "Offices", permission: "manage_offices" },
    { value: "/dashboard/admin/users", label: "Users", permission: "manage_users" },
    { value: "/dashboard/admin/roles", label: "Role Management", permission: "manage_roles" },
  ], []);

  const accessibleNavItems = useMemo(() => {
    if (!user) return [];
    return navItems.filter(item => user.role.permissions.includes(item.permission as Permission))
  }, [navItems, user]);
  
  const activeTab = useMemo(() => {
    // Find the best-matching tab for the current path
    return accessibleNavItems.find(item => pathname.startsWith(item.value))?.value || '';
  }, [accessibleNavItems, pathname]);

  useEffect(() => {
    getLoggedInUser().then(setUser);
  }, []);

  useEffect(() => {
    // This effect handles redirection logic once the user and navigation items are determined.
    if (!user || accessibleNavItems.length === 0) {
      return; // Do nothing if we don't have a user or they have no accessible items.
    }
    
    const currentTabIsValid = accessibleNavItems.some(item => pathname.startsWith(item.value));

    // If the current URL doesn't match any accessible tab, redirect to the first accessible one.
    if (!currentTabIsValid) {
      router.replace(accessibleNavItems[0].value);
    }
  }, [user, pathname, accessibleNavItems, router]);


  const handleTabChange = (value: string) => {
    router.push(value);
  };
  
  if (!user) {
    return (
        <Card>
            <CardHeader><CardTitle>Admin Settings</CardTitle></CardHeader>
            <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
        </Card>
    );
  }

  // If the user has no permissions for any admin pages, we can redirect them.
  // This check happens after all hooks have been called.
  if (accessibleNavItems.length === 0) {
    if (pathname.startsWith('/dashboard/admin')) {
      router.replace('/dashboard');
    }
    return null; 
  }
  
  // If we are on an invalid tab, we might show a loader while redirecting.
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
          <TabsContent value={activeTab} className="mt-4">
              {children}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminLayout;
