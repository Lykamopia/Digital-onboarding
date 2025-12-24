
"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRole, saveRole } from "@/app/actions/memo";
import type { Role, Permission } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { permissions } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles, useUsers } from "../hooks";

function RolesLoadingSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Role Management</CardTitle>
                <Skeleton className="h-10 w-[150px]" />
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function RoleManagementPage() {
  const { data: roles, loading: loadingRoles, mutate: mutateRoles } = useRoles();
  const { data: users, loading: loadingUsers } = useUsers();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.name);
      setSelectedPermissions(editingRole.permissions);
    } else {
      setRoleName("");
      setSelectedPermissions([]);
    }
  }, [editingRole]);


  const handleAddNew = () => {
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsDialogOpen(true);
  };

  const handleDelete = async (roleId: string) => {
    const result = await deleteRole(roleId);
    if(result?.error) {
        toast({
            variant: "destructive",
            title: "Cannot delete role",
            description: result.error,
        });
        return;
    }
    
    await mutateRoles();
    toast({
      title: "Role Deleted",
      description: "The role has been successfully deleted.",
    });
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid name",
        description: "Role name cannot be empty.",
      });
      return;
    }

    const roleData = {
        id: editingRole?.id,
        name: roleName,
        permissions: selectedPermissions,
    }

    await saveRole(roleData);
    await mutateRoles();
    
    toast({ title: "Success", description: `Role ${editingRole ? 'updated' : 'created'}.` });

    setIsDialogOpen(false);
  };

  const onPermissionChange = (permission: Permission, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };

  const usersInRole = (roleId: string) => {
    return users.filter(user => user.roleId === roleId).length;
  }

  if (loadingRoles || loadingUsers) {
    return <RolesLoadingSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Role Management</CardTitle>
        <Button onClick={handleAddNew}>Add New Role</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>{usersInRole(role.id)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={role.name === 'Admin'}>
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the role.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(role.id)}>
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit Role" : "Add New Role"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role-name" className="text-right">
                  Role Name
                </Label>
                <Input
                  id="role-name"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="col-span-3"
                  disabled={editingRole?.name === 'Admin'}
                />
              </div>
              <div>
                <Label className="text-lg font-semibold">Permissions</Label>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-1">
                  {permissions.map((permission) => (
                    <div key={permission.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Checkbox
                        id={`perm-${permission.id}`}
                        checked={selectedPermissions.includes(permission.id)}
                        onCheckedChange={(checked) => onPermissionChange(permission.id, !!checked)}
                        disabled={editingRole?.name === 'Admin'}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`perm-${permission.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {permission.label}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave}>Save Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
