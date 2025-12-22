
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/dashboard/admin') {
      router.replace('/dashboard/admin/divisions');
    }
  }, [pathname, router]);

  const navItems = [
    { value: "/dashboard/admin/divisions", label: "Divisions" },
    { value: "/dashboard/admin/departments", label: "Departments" },
    { value: "/dashboard/admin/offices", label: "Offices" },
    { value: "/dashboard/admin/users", label: "Users" },
  ];

  // Determine the active tab value. Default to divisions if the path is just /admin.
  const activeTab = navItems.find(item => pathname.startsWith(item.value))?.value || "/dashboard/admin/divisions";

  const handleTabChange = (value: string) => {
    router.push(value);
  };

  return (
    <Card>
       <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4">
             {navItems.map((item) => (
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
