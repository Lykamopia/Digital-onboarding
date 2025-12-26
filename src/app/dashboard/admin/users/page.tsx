
"use client";

import { useState, useMemo, useEffect } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { saveUser, resetUserPassword, deleteUser } from "@/app/actions/memo";
import type { User, Role, Office } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers, useOffices, useRoles } from "../hooks";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, ShieldCheck, ShieldOff, KeyRound, UserPlus, ChevronsLeft, ChevronsRight, FileDown, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

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

const ITEMS_PER_PAGE = 10;

const initialFormState = { name: '', email: '', password: '', officeId: '', roleId: '' };

export default function UsersPage() {
  const { data: users, loading: loadingUsers, mutate: mutateUsers } = useUsers();
  const { data: offices, loading: loadingOffices } = useOffices();
  const { data: roles, loading: loadingRoles } = useRoles();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null);
  
  const [resetUser, setResetUser] = useState<UserWithRelations | null>(null);
  const [deleteUserAlert, setDeleteUserAlert] = useState<UserWithRelations | null>(null);
  const [passwordDialog, setPasswordDialog] = useState({ open: false, password: "" });
  
  const [formState, setFormState] = useState(initialFormState);

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return (users as UserWithRelations[]).slice(start, end);
  }, [users, currentPage]);

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!formState.name || !formState.email || !formState.officeId || !formState.roleId) {
        toast({ title: "Error", description: "All fields except password are required.", variant: "destructive" });
        return;
    }
    
    const isNewUser = !editingUser?.id;
    let passwordToSend = formState.password;

    if (isNewUser) {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        let password = "";
        for (let i = 0, n = charset.length; i < length; ++i) {
            password += charset.charAt(Math.floor(Math.random() * n));
        }
        if (!/\d/.test(password)) password += '1';
        if (!/[a-z]/.test(password)) password += 'a';
        if (!/[A-Z]/.test(password)) password += 'A';
        if (!/[!@#$%^&*()]/.test(password)) password += '!';
        passwordToSend = password.slice(0, length);
    }

    const userData = {
        id: editingUser?.id,
        name: formState.name,
        email: formState.email,
        officeId: formState.officeId,
        roleId: formState.roleId,
        password: passwordToSend || undefined,
        status: editingUser?.status ?? 'active',
    };

    await saveUser(userData);
    await mutateUsers();
    
    toast({ title: "Success", description: `User ${editingUser?.id ? 'updated' : 'created'}.` });
    
    setIsFormDialogOpen(false);
    setEditingUser(null);
    setFormState(initialFormState);
    
    if (isNewUser && passwordToSend) {
        setPasswordDialog({ open: true, password: passwordToSend });
    }
  };
  
  const handleDialogClose = (open: boolean) => {
    setIsFormDialogOpen(open);
    if (!open) {
      setEditingUser(null);
      setFormState(initialFormState);
    }
    // Force cleanup of any remaining overlay elements
    // Use requestAnimationFrame to ensure state update happens first
    if (!open) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Remove any remaining Radix UI dialog overlays
          const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
          overlays.forEach(overlay => {
            const state = overlay.getAttribute('data-state');
            if (!state || state === 'closed') {
              (overlay as HTMLElement).style.display = 'none';
              overlay.remove();
            }
          });
          // Ensure body styles are reset
          document.body.style.pointerEvents = '';
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
        }, 200);
      });
    }
  };

  const handlePasswordDialogClose = (open: boolean) => {
    if (!open) {
      setPasswordDialog({ open: false, password: "" });
      // Force cleanup of any remaining overlay elements
      setTimeout(() => {
        const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
        overlays.forEach(overlay => {
          const state = overlay.getAttribute('data-state');
          if (!state || state === 'closed') {
            (overlay as HTMLElement).style.display = 'none';
            overlay.remove();
          }
        });
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }, 200);
    } else {
      setPasswordDialog(prev => ({ ...prev, open: true }));
    }
  };

  const handleAlertClose = (open: boolean) => {
    if (!open) {
      setResetUser(null);
      setDeleteUserAlert(null);
    }
    // Force cleanup of any remaining overlay elements (both dialog and alert-dialog)
    // Use requestAnimationFrame to ensure state update happens first
    if (!open) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Clean up all possible overlay elements using Radix UI data attributes
          const allOverlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
          allOverlays.forEach(overlay => {
            const state = overlay.getAttribute('data-state');
            if (!state || state === 'closed') {
              (overlay as HTMLElement).style.display = 'none';
              overlay.remove();
            }
          });
          // Ensure body styles are reset
          document.body.style.pointerEvents = '';
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
        }, 200);
      });
    }
  };


  const handleEdit = (user: UserWithRelations) => {
    setEditingUser(user);
    setFormState({
        name: user.name || '',
        email: user.email || '',
        officeId: user.officeId || '',
        roleId: user.roleId || '',
        password: '',
    });
    setIsFormDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingUser(null);
    setFormState(initialFormState);
    setIsFormDialogOpen(true);
  }
  
  const handleResetPassword = async () => {
    if (!resetUser) return;
    const result = await resetUserPassword(resetUser.id);
    setResetUser(null); // Close the alert dialog first
    if(result.success && result.newPassword) {
      // Small delay to ensure alert dialog is fully closed before opening password dialog
      setTimeout(() => {
        setPasswordDialog({ open: true, password: result.newPassword });
        toast({ title: "Success", description: "Password has been reset." });
      }, 100);
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

    const handleDelete = async () => {
        if (!deleteUserAlert) return;
        const result = await deleteUser(deleteUserAlert.id);
        setDeleteUserAlert(null);
        if (result.success) {
            await mutateUsers();
            toast({ title: "Success", description: "User has been deleted." });
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    }

  const handleStatusChange = async (user: UserWithRelations) => {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await saveUser({ 
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        officeId: user.officeId || '',
        roleId: user.roleId || '',
        status: newStatus 
      });
      await mutateUsers();
      toast({ title: "Success", description: `User has been ${newStatus}.` });
  }

  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
      await Promise.all(selectedUsers.map(id => {
          const user = users.find(u => u.id === id) as UserWithRelations | undefined;
          if (user) {
            return saveUser({ 
              id: user.id,
              name: user.name || '',
              email: user.email || '',
              officeId: user.officeId || '',
              roleId: user.roleId || '',
              status 
            });
          }
      }));
      await mutateUsers();
      setSelectedUsers([]);
      toast({ title: "Success", description: `Selected users have been ${status}.`});
  }

  const handleExport = () => {
    const dataToExport = users.filter(u => selectedUsers.includes(u.id));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'users.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSelectedUsers([]);
  }

  const officeOptions = offices.map(o => ({ value: o.id, label: o.name }));
  const roleOptions = roles.map(r => ({ value: r.id, label: r.name }));

  const handleFormChange = (field: keyof typeof formState, value: string) => {
      setFormState(prev => ({ ...prev, [field]: value }));
  }

  // Cleanup body styles and overlays when all dialogs are closed
  useEffect(() => {
    const allDialogsClosed = !isFormDialogOpen && !passwordDialog.open && !resetUser && !deleteUserAlert;
    
    if (allDialogsClosed) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        // Remove any lingering overlay elements (both Dialog and AlertDialog)
        const allOverlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
        allOverlays.forEach(overlay => {
          const state = overlay.getAttribute('data-state');
          if (!state || state === 'closed') {
            (overlay as HTMLElement).style.display = 'none';
            overlay.remove();
          }
        });
        // Ensure body styles are reset
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      });
    }
  }, [isFormDialogOpen, passwordDialog.open, resetUser, deleteUserAlert]);

  if (loadingUsers || loadingOffices || loadingRoles) {
    return <UsersLoadingSkeleton />;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Users</CardTitle>
        <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={selectedUsers.length === 0}>
                  Bulk Actions ({selectedUsers.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={handleExport}><FileDown className="mr-2" /> Export Selected</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleBulkStatusChange('active')}><ShieldCheck className="mr-2" /> Activate Selected</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleBulkStatusChange('inactive')}><ShieldOff className="mr-2" /> Deactivate Selected</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleAddNew}><UserPlus className="mr-2"/>Add User</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12">
                    <Checkbox
                        checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                        onCheckedChange={(checked) => {
                            setSelectedUsers(checked ? paginatedUsers.map(u => u.id) : []);
                        }}
                    />
                </TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedUsers.map((user, index) => (
                    <TableRow key={user.id} data-state={selectedUsers.includes(user.id) ? 'selected' : ''}>
                        <TableCell>
                            <Checkbox
                                checked={selectedUsers.includes(user.id)}
                                onCheckedChange={(checked) => {
                                    setSelectedUsers(prev => checked ? [...prev, user.id] : prev.filter(id => id !== user.id));
                                }}
                            />
                        </TableCell>
                        <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ''} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>{user.role.name}</TableCell>
                        <TableCell>{user.office?.name}</TableCell>
                        <TableCell>{user.office?.department.name}</TableCell>
                        <TableCell>{user.office?.department.division.name}</TableCell>
                        <TableCell>
                            <Badge variant={user.status === 'active' ? 'secondary' : 'destructive'} className={cn(user.status === 'active' && 'bg-green-100 text-green-800')}>
                                {user.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => handleEdit(user)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit User
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setResetUser(user)}>
                                        <KeyRound className="mr-2"/>Reset Password
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => handleStatusChange(user)}>
                                        {user.status === 'active' ? <><ShieldOff className="mr-2"/>Deactivate</> : <><ShieldCheck className="mr-2"/>Activate</>}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setDeleteUserAlert(user)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete User
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
      </CardContent>
    </Card>

    <Dialog open={isFormDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                <DialogDescription>
                    {editingUser ? 'Update the details for this user.' : 'A secure password will be generated for the new user.'}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" name="name" value={formState.name} onChange={e => handleFormChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" name="email" type="email" value={formState.email} onChange={e => handleFormChange('email', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="officeId">Office</Label>
                        <Combobox
                            options={officeOptions}
                            value={formState.officeId}
                            onChange={v => handleFormChange('officeId', v)}
                            placeholder="Select an office"
                            searchPlaceholder="Search offices..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="roleId">Role</Label>
                        <Combobox
                            options={roleOptions}
                            value={formState.roleId}
                            onChange={v => handleFormChange('roleId', v)}
                            placeholder="Select a role"
                            searchPlaceholder="Search roles..."
                        />
                    </div>
                    {editingUser && (
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="password">New Password</Label>
                            <Input id="password" name="password" type="password" placeholder="Leave blank to keep current password" value={formState.password} onChange={e => handleFormChange('password', e.target.value)} />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
                    <Button type="submit">Save User</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    
    <AlertDialog open={!!resetUser} onOpenChange={(open) => !open && handleAlertClose(false)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                This will reset the password for {resetUser?.name}. A new temporary password will be generated. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={(e) => {
                    e.preventDefault();
                    handleAlertClose(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleResetPassword}>
                Reset Password
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <AlertDialog open={!!deleteUserAlert} onOpenChange={(open) => !open && handleAlertClose(false)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the user account for {deleteUserAlert?.name}.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => handleAlertClose(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete User</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <Dialog open={passwordDialog.open} onOpenChange={handlePasswordDialogClose}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Generated Password</DialogTitle>
                <DialogDescription>
                    A new password has been generated for the user. Please copy and share it securely.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                    <Label htmlFor="link" className="sr-only">Password</Label>
                    <Input id="link" value={passwordDialog.password} readOnly />
                </div>
                <Button type="submit" size="sm" className="px-3" onClick={() => {
                    navigator.clipboard.writeText(passwordDialog.password);
                    toast({ title: 'Copied!', description: 'Password copied to clipboard.'});
                }}>
                    <span className="sr-only">Copy</span>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
            <DialogFooter>
                <Button onClick={() => handlePasswordDialogClose(false)}>Done</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
