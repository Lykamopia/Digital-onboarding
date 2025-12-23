
"use client";

import { useEffect, useMemo, use } from "react";
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
import type { Permission } from "@/lib/types";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const user = use(getLoggedInUser());

  const navItems = useMemo(() => [
    { value: "/dashboard/admin/divisions", label: "Divisions", permission: "manage_divisions" },
    { value: "/dashboard/admin/departments", label: "Departments", permission: "manage_departments" },
    { value: "/dashboard/admin/offices", label: "Offices", permission: "manage_offices" },
    { value: "/dashboard/admin/users", label: "Users", permission: "manage_users" },
    { value: "/dashboard/admin/roles", label: "Role Management", permission: "manage_roles" },
  ], []);

  const accessibleNavItems = useMemo(() => navItems.filter(item => user.role.permissions.includes(item.permission as Permission)), [navItems, user]);

  useEffect(() => {
    if (pathname === '/dashboard/admin' && accessibleNavItems.length > 0) {
      router.replace(accessibleNavItems[0].value);
    } else if (accessibleNavItems.length > 0 && !accessibleNavItems.some(item => pathname.startsWith(item.value))) {
       router.replace(accessibleNavItems[0].value);
    } else if (accessibleNavItems.length === 0) {
        router.replace('/dashboard');
    }
  }, [pathname, router, accessibleNavItems]);

  const activeTab = accessibleNavItems.find(item => pathname.startsWith(item.value))?.value || (accessibleNavItems.length > 0 ? accessibleNavItems[0].value : "");

  const handleTabChange = (value: string) => {
    router.push(value);
  };

  if (accessibleNavItems.length === 0 || !user) {
    return null; 
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
          <TabsContent value={pathname} className="mt-4">
            {children}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminLayout;
