
"use client";

import { useState, useEffect, useMemo } from "react";
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
import { ChevronsLeft, ChevronsRight, PlusCircle, Trash2, Edit, Loader2 } from "lucide-react";

const ITEMS_PER_PAGE = 5;

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

  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedRoles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return roles.slice(start, end);
  }, [roles, currentPage]);

  const totalPages = Math.ceil(roles.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (isDialogOpen && editingRole) {
      setRoleName(editingRole.name || "");
      setSelectedPermissions(editingRole.permissions || []);
    } else {
      setRoleName("");
      setSelectedPermissions([]);
    }
  }, [isDialogOpen, editingRole]);


  const handleAddNew = () => {
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIsDialogOpen(true);
  };

  const handleDelete = async (roleId: string) => {
    if (!roleId) return;
    setIsSaving(true);
    try {
      const result = await deleteRole(roleId);
      if(result?.error) {
          toast({ variant: "destructive", title: "Cannot delete role", description: result.error, });
          return;
      }
      await mutateRoles();
      toast({ title: "Role Deleted", description: "The role has been successfully deleted.", });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to delete role.' });
    } finally {
      setIsSaving(false);
    }
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

    setIsSaving(true);
    try {
      await saveRole(roleData);
      await mutateRoles();
      toast({ title: "Success", description: `Role ${editingRole?.id ? 'updated' : 'created'}.` });
      setIsDialogOpen(false);
      setEditingRole(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to save role.' });
    } finally {
      setIsSaving(false);
    }
  };

  const onPermissionChange = (permission: Permission, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };
  
  const handleDialogChange = (open: boolean) => {
      if (!open) {
          setEditingRole(null);
      }
      setIsDialogOpen(open);
  }

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
        <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Role
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Role Name</TableHead>
                <TableHead>Users</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedRoles.map((role, index) => (
                <TableRow key={role.id}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{usersInRole(role.id)}</TableCell>
                    <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={role.name === 'Admin' || usersInRole(role.id) > 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
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
        </div>
        
        <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronsLeft/> Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronsRight/></Button>
            </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRole?.id ? "Edit Role" : "Add New Role"}</DialogTitle>
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
                    <Button variant="outline" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Role
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
