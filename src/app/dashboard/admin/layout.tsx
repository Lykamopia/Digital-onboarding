
"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { loggedInUser } from "@/lib/data";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = useMemo(() => [
    { value: "/dashboard/admin/divisions", label: "Divisions", permission: "manage-divisions" },
    { value: "/dashboard/admin/departments", label: "Departments", permission: "manage-departments" },
    { value: "/dashboard/admin/offices", label: "Offices", permission: "manage-offices" },
    { value: "/dashboard/admin/users", label: "Users", permission: "manage-users" },
    { value: "/dashboard/admin/roles", label: "Role Management", permission: "manage-roles" },
  ], []);

  const accessibleNavItems = useMemo(() => navItems.filter(item => loggedInUser.role.permissions.includes(item.permission as any)), [navItems]);

  useEffect(() => {
    if (pathname === '/dashboard/admin' && accessibleNavItems.length > 0) {
      router.replace(accessibleNavItems[0].value);
    } else if (accessibleNavItems.length > 0 && !accessibleNavItems.some(item => pathname.startsWith(item.value))) {
       router.replace(accessibleNavItems[0].value);
    } else if (accessibleNavItems.length === 0) {
        router.replace('/dashboard');
    }
  }, [pathname, router, accessibleNavItems]);

  // Determine the active tab value.
  const activeTab = accessibleNavItems.find(item => pathname.startsWith(item.value))?.value || (accessibleNavItems.length > 0 ? accessibleNavItems[0].value : "");

  const handleTabChange = (value: string) => {
    router.push(value);
  };

  if (accessibleNavItems.length === 0) {
    return null; // Or a loading/unauthorized state
  }

  return (
    <Card>
       <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className={`grid w-full grid-cols-${accessibleNavItems.length}`}>
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
