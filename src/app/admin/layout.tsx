"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin/divisions", label: "Divisions" },
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/offices", label: "Offices" },
    { href: "/admin/users", label: "Users" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Settings</CardTitle>
          <CardDescription>
            Manage organizational structure and users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={pathname === item.href ? "secondary" : "ghost"}
                className="justify-start"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
        </CardContent>
      </Card>
      <div>{children}</div>
    </div>
  );
};

export default AdminLayout;
