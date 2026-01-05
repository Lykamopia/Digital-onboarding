
"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  DialogDescription,
  DialogTrigger,
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
import { saveUser, resetUserPassword, deleteUser, bulkImportUsers, type BulkImportResult } from "@/app/actions/memo";
import type { User, Role, Office, Department, Division, District, Branch } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers, useOffices, useRoles, useDepartments, useDivisions, useDistricts, useBranches } from "../hooks";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, ShieldCheck, ShieldOff, KeyRound, UserPlus, ChevronsLeft, ChevronsRight, FileDown, Pencil, Trash2, Loader2, UploadCloud, Download, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type UserWithRelations = User & {
    office: Office;
    role: Role;
    department?: Department;
    division?: Division;
    district?: District;
    branch?: Branch;
};

function UserImportDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: mutateUsers } = useUsers();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
        toast.error("Invalid File Type", { description: "Please upload a CSV or XLSX file." });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{ 
        name: "Jane Doe", 
        email: "jane.doe@example.com", 
        role: "Member", 
        office: "Head Office",
        department: "Retail Banking",
        division: "Client Services",
        district: "", // Can be empty if office is not branch-based
        branch: "" // Can be empty if office is not branch-based
    }];
    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'user_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImport = async () => {
    if (!file) return;
    setProcessing(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const fileData = e.target?.result;
        if (typeof fileData !== 'string') {
            toast.error("File Read Error", { description: "Could not read the file." });
            setProcessing(false);
            return;
        }
        try {
            const importResult = await bulkImportUsers(fileData, file.type);
            setResult(importResult);
            if (importResult.successCount > 0) {
              await mutateUsers();
            }
        } catch (error: any) {
            toast.error("Import Failed", { description: error.message });
        } finally {
            setProcessing(false);
        }
    };
    if (file.type.includes('csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
  };
  
  const resetState = () => {
    setFile(null);
    setProcessing(false);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline"><UploadCloud className="mr-2"/> Import</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>
            Import multiple users at once by uploading a CSV or XLSX file.
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="py-4 space-y-6">
            <div className="p-4 rounded-md border border-dashed bg-muted/50 text-center">
                <h3 className="font-semibold text-lg">1. Download Template</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Start by downloading the CSV template. Use a spreadsheet program like Excel or Google Sheets to fill it out.
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={handleDownloadTemplate}>
                    <Download className="mr-2" /> Download CSV Template
                </Button>
            </div>

            <div className="p-4 rounded-md border border-dashed bg-muted/50 text-center">
                <h3 className="font-semibold text-lg">2. Upload File</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Once you've filled out the template, upload the saved CSV or XLSX file here.
                </p>
                <div 
                    className="mt-4 flex justify-center items-center h-24 border-2 border-dashed rounded-md cursor-pointer hover:border-primary"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden"/>
                    {file ? (
                        <div className="text-center">
                            <FileSpreadsheet className="h-6 w-6 mx-auto text-green-500" />
                            <p className="text-sm font-medium">{file.name}</p>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">Click to select a file</div>
                    )}
                </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleImport} disabled={!file || processing}>
                {processing ? <Loader2 className="mr-2 animate-spin"/> : <UploadCloud className="mr-2"/>}
                {processing ? "Importing..." : "Start Import"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-4 space-y-4">
              <div className="text-center">
                  <h3 className="text-xl font-bold">Import Complete</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-100/60 dark:bg-green-900/40 rounded-lg text-center">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold">{result.successCount}</p>
                      <p className="text-sm text-muted-foreground">Users Imported</p>
                  </div>
                  <div className="p-4 bg-red-100/60 dark:bg-red-900/40 rounded-lg text-center">
                      <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <p className="text-3xl font-bold">{result.errorCount}</p>
                      <p className="text-sm text-muted-foreground">Rows Failed</p>
                  </div>
              </div>
              {result.errorCount > 0 && (
                  <div className="space-y-2">
                      <h4 className="font-semibold">Failure Details:</h4>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/50 text-sm">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Row</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>Error</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {result.errors.map((err, i) => (
                                      <TableRow key={i}>
                                          <TableCell>{err.rowIndex}</TableCell>
                                          <TableCell>{err.email}</TableCell>
                                          <TableCell>{err.error}</TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </div>
                  </div>
              )}
              <DialogFooter>
                  <Button onClick={() => setOpen(false)}>Close</Button>
              </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


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

const initialFormState = { 
    name: '', email: '', roleId: '',
    officeId: '', departmentId: '', divisionId: '', districtId: '', branchId: ''
};

export default function UsersPage() {
  const { data: users, loading: loadingUsers, mutate: mutateUsers } = useUsers();
  const { data: offices, loading: loadingOffices } = useOffices();
  const { data: roles, loading: loadingRoles } = useRoles();
  const { data: departments, loading: loadingDepts } = useDepartments();
  const { data: divisions, loading: loadingDivisions } = useDivisions();
  const { data: districts, loading: loadingDistricts } = useDistricts();
  const { data: branches, loading: loadingBranches } = useBranches();
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null);
  
  const [resetUser, setResetUser] = useState<UserWithRelations | null>(null);
  const [deleteUserAlert, setDeleteUserAlert] = useState<UserWithRelations | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
        toast.error("Error", { description: "Name, Email, Office and Role are required." });
        return;
    }
    
    const isNewUser = !editingUser?.id;

    const userData = {
        id: editingUser?.id,
        ...formState,
        status: editingUser?.status ?? 'active',
    };

        setIsSaving(true);
        try {
            const result = await saveUser(userData);
            if (result.error) {
                toast.error(isNewUser ? 'Error Creating User' : 'Error Updating User', { description: result.error });
                // We don't close the dialog on error so the user can fix it
                return;
            }
            await mutateUsers();
            toast.success("Success", { description: isNewUser ? `User created and a welcome email has been sent to ${formState.email}.` : "User updated successfully." });
            setIsFormDialogOpen(false);
            setEditingUser(null);
            setFormState(initialFormState);
        } catch (error: any) {
            toast.error('Error', { description: error?.message || 'Failed to save user.' });
        } finally {
            setIsSaving(false);
        }
  };
  
  const handleDialogClose = (open: boolean) => {
    setIsFormDialogOpen(open);
    if (!open) {
      setEditingUser(null);
      setFormState(initialFormState);
      // Force cleanup of any remaining overlay elements
      setTimeout(() => {
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
    }
  };

  const handleAlertClose = (open: boolean) => {
    if (!open) {
      setResetUser(null);
      setDeleteUserAlert(null);
      // Force cleanup of any remaining overlay elements
      setTimeout(() => {
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
    }
  };


  const handleEdit = (user: UserWithRelations) => {
    setEditingUser(user);
    setFormState({
        name: user.name || '',
        email: user.email || '',
        roleId: user.roleId || '',
        officeId: user.officeId || '',
        departmentId: user.departmentId || '',
        divisionId: user.divisionId || '',
        districtId: user.districtId || '',
        branchId: user.branchId || '',
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
        setIsResetting(true);
        try {
            const result = await resetUserPassword(resetUser.id);
            setResetUser(null); // Close the alert dialog
            if(result.success) {
                    toast.success("Success", { description: `A password reset email has been sent to ${resetUser.email}.` });
            } else {
                    toast.error("Error", { description: result.error });
            }
        } catch (error: any) {
            toast.error('Error', { description: error?.message || 'Failed to reset password.' });
        } finally {
            setIsResetting(false);
        }
  }

    const handleDelete = async () => {
        if (!deleteUserAlert) return;
                setIsDeleting(true);
                try {
                    const result = await deleteUser(deleteUserAlert.id);
                    setDeleteUserAlert(null);
                    if (result.success) {
                            await mutateUsers();
                            toast.success("Success", { description: "User has been deleted." });
                    } else {
                            toast.error("Error", { description: result.error });
                    }
                } catch (error: any) {
                    toast.error('Error', { description: error?.message || 'Failed to delete user.' });
                } finally {
                    setIsDeleting(false);
                }
    }

  const handleStatusChange = async (user: UserWithRelations) => {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
            try {
                await saveUser({ id: user.id, name: user.name || '', email: user.email || '', roleId: user.roleId || '', status: newStatus });
                await mutateUsers();
                toast.success("Success", { description: `User has been ${newStatus}.` });
            } catch (error: any) {
                toast.error('Error', { description: error?.message || 'Failed to change status.' });
            }
  }

  const handleBulkStatusChange = async (status: 'active' | 'inactive') => {
            try {
                await Promise.all(selectedUsers.map(id => {
                        const user = users.find(u => u.id === id) as UserWithRelations | undefined;
                        if (user) {
                            return saveUser({ id: user.id, name: user.name || '', email: user.email || '', roleId: user.roleId || '', status });
                        }
                        return Promise.resolve();
                }));
                await mutateUsers();
                setSelectedUsers([]);
                toast.success("Success", { description: `Selected users have been ${status}.`});
            } catch (error: any) {
                toast.error('Error', { description: error?.message || 'Failed to update selected users.' });
            }
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

  const selectedOffice = offices.find(o => o.id === formState.officeId);

  const departmentOptions = departments
    .filter(d => d.officeId === formState.officeId)
    .map(d => ({ value: d.id, label: d.name }));
    
  const divisionOptions = divisions
    .filter(d => d.departmentId === formState.departmentId)
    .map(d => ({ value: d.id, label: d.name }));

  const districtOptions = districts
    .filter(d => d.officeId === formState.officeId)
    .map(d => ({ value: d.id, label: d.name }));

  const branchOptions = branches
    .filter(b => b.districtId === formState.districtId)
    .map(b => ({ value: b.id, label: b.name }));


  const getUserAssignment = (user: UserWithRelations) => {
      const path = [user.office?.name];
      if(user.department) path.push(user.department.name);
      if(user.division) path.push(user.division.name);
      if(user.district) path.push(user.district.name);
      if(user.branch) path.push(user.branch.name);
      return path.filter(Boolean).join(' / ');
  }

  if (loadingUsers || loadingOffices || loadingRoles || loadingDepts || loadingDivisions || loadingDistricts || loadingBranches) {
    return <UsersLoadingSkeleton />;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Users</CardTitle>
        <div className="flex gap-2">
            <UserImportDialog />
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
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedUsers.map((user) => (
                    <TableRow key={user.id} data-state={selectedUsers.includes(user.id) ? 'selected' : ''} className="group">
                        <TableCell>
                             <div className="relative h-10 w-10 flex items-center justify-center">
                                <Avatar className={cn("h-9 w-9 absolute transition-all duration-300", selectedUsers.includes(user.id) ? "opacity-0 scale-50" : "group-hover:opacity-0 group-hover:scale-50")}>
                                    <AvatarImage src={user.avatar ?? undefined} alt={user.name ?? ''} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Checkbox
                                    checked={selectedUsers.includes(user.id)}
                                    onCheckedChange={(checked) => {
                                        setSelectedUsers(prev => checked ? [...prev, user.id] : prev.filter(id => id !== user.id));
                                    }}
                                    className={cn("absolute transition-all duration-300", selectedUsers.includes(user.id) ? "opacity-100 scale-100" : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100")}
                                />
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>{user.role?.name}</TableCell>
                        <TableCell>{getUserAssignment(user)}</TableCell>
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
                    {editingUser ? 'Update the details for this user.' : 'A secure temporary password will be generated and emailed to the new user.'}
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
                        <Label htmlFor="roleId">Role</Label>
                        <Combobox
                            options={roleOptions}
                            value={formState.roleId}
                            onChange={v => handleFormChange('roleId', v)}
                            placeholder="Select a role"
                            searchPlaceholder="Search roles..."
                        />
                    </div>
                    
                    <Separator className="md:col-span-2" />

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="officeId">Office</Label>
                            <Combobox
                                options={officeOptions}
                                value={formState.officeId}
                                onChange={v => setFormState({...initialFormState, name: formState.name, email: formState.email, roleId: formState.roleId, officeId: v })}
                                placeholder="Select an office"
                                searchPlaceholder="Search offices..."
                            />
                        </div>
                        {selectedOffice && (
                            <div className="space-y-4">
                                {selectedOffice.type === 'division_office' && departmentOptions.length > 0 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="departmentId">Department</Label>
                                        <Combobox options={departmentOptions} value={formState.departmentId} onChange={v => handleFormChange('departmentId', v)} placeholder="Select Department" />
                                    </div>
                                )}
                                {formState.departmentId && divisionOptions.length > 0 && (
                                     <div className="space-y-2">
                                        <Label htmlFor="divisionId">Division</Label>
                                        <Combobox options={divisionOptions} value={formState.divisionId} onChange={v => handleFormChange('divisionId', v)} placeholder="Select Division" />
                                    </div>
                                )}
                                {selectedOffice.type === 'branch_office' && districtOptions.length > 0 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="districtId">District</Label>
                                        <Combobox options={districtOptions} value={formState.districtId} onChange={v => handleFormChange('districtId', v)} placeholder="Select District" />
                                    </div>
                                )}
                                {formState.districtId && branchOptions.length > 0 && (
                                     <div className="space-y-2">
                                        <Label htmlFor="branchId">Branch</Label>
                                        <Combobox options={branchOptions} value={formState.branchId} onChange={v => handleFormChange('branchId', v)} placeholder="Select Branch" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save User
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    
    <AlertDialog open={!!resetUser} onOpenChange={(open) => !open && handleAlertClose(false)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                This will reset the password for {resetUser?.name}. A new temporary password will be emailed to the user. This action cannot be undone.
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
                <AlertDialogCancel 
                  onClick={(e) => {
                    e.preventDefault();
                    handleAlertClose(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete User</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
