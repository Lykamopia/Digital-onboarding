
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { saveOffice, deleteOffice } from "@/app/actions/memo";
import type { Office } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffices, useDepartments } from "../hooks";
import { ChevronsLeft, ChevronsRight, MoreHorizontal, Edit, Trash2, PlusCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

type OfficeWithRelations = Office & { department: { name: string, division: { name: string } } };

const ITEMS_PER_PAGE = 10;

function OfficesLoadingSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Offices</CardTitle>
                <Skeleton className="h-10 w-[150px]" />
            </CardHeader>
            <CardContent>
                 <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function OfficesPage() {
  const { data: offices, loading: loadingOffices, mutate: mutateOffices } = useOffices();
  const { data: departments, loading: loadingDepts } = useDepartments();
  const { toast } = useToast();

  const [editingOffice, setEditingOffice] = useState<Partial<Office> | null>(null);
  const [deletingOffice, setDeletingOffice] = useState<Office | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedOffices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return (offices as OfficeWithRelations[]).slice(start, end);
  }, [offices, currentPage]);

  const totalPages = Math.ceil(offices.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (isDialogOpen && editingOffice?.departmentId) {
      setSelectedDepartmentId(editingOffice.departmentId);
    } else {
      setSelectedDepartmentId(undefined);
    }
  }, [isDialogOpen, editingOffice]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;

    if (!name || !code || !selectedDepartmentId) {
        toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
        return;
    }
    
    const officeData = {
      id: editingOffice?.id,
      name,
      code,
      departmentId: selectedDepartmentId,
    };

    await saveOffice(officeData);
    await mutateOffices();
    
    toast({ title: "Success", description: `Office ${editingOffice?.id ? 'updated' : 'created'} successfully.` });

    setIsDialogOpen(false);
    setEditingOffice(null);
    setSelectedDepartmentId(undefined);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingOffice(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (office: Office) => {
    setDeletingOffice(office);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingOffice) return;

    const result = await deleteOffice(deletingOffice.id);
    if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
        toast({ title: "Success", description: "Office deleted successfully." });
        await mutateOffices();
    }
    
    setIsAlertOpen(false);
    setDeletingOffice(null);
  };
  
  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingOffice(null);
      setSelectedDepartmentId(undefined);
    }
    // Force cleanup of any remaining overlay elements
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
  }
  
  const handleAlertChange = (open: boolean) => {
    if (!open) {
      setDeletingOffice(null);
    }
    setIsAlertOpen(open);
    // Force cleanup of any remaining overlay elements
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
  }

  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));

  if (loadingOffices || loadingDepts) {
    return <OfficesLoadingSkeleton />;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Offices</CardTitle>
        <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Office
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedOffices.map((office, index) => (
                    <TableRow key={office.id}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{office.name}</TableCell>
                    <TableCell>{office.code}</TableCell>
                    <TableCell>{office.department.name}</TableCell>
                    <TableCell>{office.department.division.name}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleEdit(office)}><Edit className="mr-2"/>Edit</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDelete(office)} className="text-destructive"><Trash2 className="mr-2"/>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                )
                )}
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
    
    <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
        <DialogHeader>
            <DialogTitle>{editingOffice?.id ? "Edit Office" : "Add New Office"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={editingOffice?.name} className="col-span-3"/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Code</Label>
                <Input id="code" name="code" defaultValue={editingOffice?.code} className="col-span-3"/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="departmentId" className="text-right">Department</Label>
                <Combobox
                    options={departmentOptions}
                    value={selectedDepartmentId}
                    onChange={setSelectedDepartmentId}
                    placeholder="Select a department"
                    searchPlaceholder="Search departments..."
                    className="col-span-3"
                />
            </div>
            </div>
            <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
            </DialogFooter>
        </form>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isAlertOpen} onOpenChange={handleAlertChange}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the office '{deletingOffice?.name}'.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={(e) => {
                    e.preventDefault();
                    handleAlertChange(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
