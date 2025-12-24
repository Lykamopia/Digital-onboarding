
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { saveUser } from "@/app/actions/memo";
import type { User, Role, Office } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers, useOffices, useRoles } from "../hooks";

type UserWithRelations = User & {
    office: Office & {
        department: {
            name: string,
            division: { name: string }
        }
    },
    role: Role
};

function UsersLoadingSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Users</CardTitle>
                <Skeleton className="h-10 w-[150px]" />
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function UsersPage() {
  const { users, loading: loadingUsers, mutate: mutateUsers } = useUsers();
  const { data: offices, loading: loadingOffices } = useOffices();
  const { data: roles, loading: loadingRoles } = useRoles();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | undefined>(undefined);
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(undefined);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    if (!name || !email || !selectedOfficeId || !selectedRoleId) {
        toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
        return;
    }
    
    const userData = {
        id: editingUser?.id,
        name,
        email,
        officeId: selectedOfficeId,
        roleId: selectedRoleId,
    };

    await saveUser(userData);
    await mutateUsers();
    
    toast({ title: "Success", description: `User ${editingUser ? 'updated' : 'created'}.` });
    
    setIsDialogOpen(false);
  };

  const handleEdit = (user: UserWithRelations) => {
    setEditingUser(user);
    setSelectedOfficeId(user.officeId);
    setSelectedRoleId(user.roleId);
    setIsDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingUser(null);
    setSelectedOfficeId(undefined);
    setSelectedRoleId(undefined);
    setIsDialogOpen(true);
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setEditingUser(null);
        setSelectedOfficeId(undefined);
        setSelectedRoleId(undefined);
    }
    setIsDialogOpen(open);
  }

  const officeOptions = offices.map(o => ({ 
      value: o.id, 
      label: o.name
  }));

  const roleOptions = roles.map(r => ({ value: r.id, label: r.name }));

  if (loadingUsers || loadingOffices || loadingRoles) {
    return <UsersLoadingSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Users</CardTitle>
        <Button onClick={handleAddNew}>Add User</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as UserWithRelations[]).map((user) => (
                <TableRow key={user.id}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar} alt={user.name} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>{user.role.name}</TableCell>
                    <TableCell>{user.office.name}</TableCell>
                    <TableCell>{user.office.department.name}</TableCell>
                    <TableCell>{user.office.department.division.name}</TableCell>
                    <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                        Edit
                    </Button>
                    </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>

         <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" defaultValue={editingUser?.name} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingUser?.email} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="officeId" className="text-right">Office</Label>
                   <Combobox
                        options={officeOptions}
                        value={selectedOfficeId}
                        onChange={setSelectedOfficeId}
                        placeholder="Select an office"
                        searchPlaceholder="Search offices..."
                        className="col-span-3"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="roleId" className="text-right">Role</Label>
                   <Combobox
                        options={roleOptions}
                        value={selectedRoleId}
                        onChange={setSelectedRoleId}
                        placeholder="Select a role"
                        searchPlaceholder="Search roles..."
                        className="col-span-3"
                    />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

