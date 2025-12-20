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
import { users as initialUsers, offices, departments, divisions } from "@/lib/data";
import type { User } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | undefined>(undefined);

  const getOfficeInfo = (officeId: string) => {
    const office = offices.find(o => o.id === officeId);
    if (!office) return { office: 'N/A', department: 'N/A', division: 'N/A' };
    const department = departments.find(d => d.id === office.departmentId);
    if (!department) return { office: office.name, department: 'N/A', division: 'N/A' };
    const division = divisions.find(d => d.id === department.divisionId);
    return {
        office: office.name,
        department: department.name,
        division: division?.name || 'N/A'
    };
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const officeId = selectedOfficeId || '';
    const officeInfo = getOfficeInfo(officeId);
    
    const userData: User = {
        id: editingUser ? editingUser.id : `user-${Date.now()}`,
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        avatar: editingUser?.avatar || '',
        officeId: officeId,
        division: officeInfo.division,
        department: officeInfo.department,
        office: officeInfo.office,
    };

    if (editingUser) {
        setUsers(users.map(u => u.id === editingUser.id ? userData : u));
    } else {
        setUsers([...users, userData]);
    }
    
    setIsDialogOpen(false);
    setEditingUser(null);
    setSelectedOfficeId(undefined);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setSelectedOfficeId(user.officeId);
    setIsDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingUser(null);
    setSelectedOfficeId(undefined);
    setIsDialogOpen(true);
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setEditingUser(null);
        setSelectedOfficeId(undefined);
    }
    setIsDialogOpen(open);
  }

  const officeOptions = offices.map(o => ({ 
      value: o.id, 
      label: `${o.name} (${getOfficeInfo(o.id).department})` 
  }));

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
              <TableHead>Office</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const officeInfo = getOfficeInfo(user.officeId);
              return(
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
                    <TableCell>{officeInfo.office}</TableCell>
                    <TableCell>{officeInfo.department}</TableCell>
                    <TableCell>{officeInfo.division}</TableCell>
                    <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                        Edit
                    </Button>
                    </TableCell>
                </TableRow>
              );
            })}
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
