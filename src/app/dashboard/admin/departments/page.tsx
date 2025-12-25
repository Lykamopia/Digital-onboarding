
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
import { saveDepartment, deleteDepartment } from "@/app/actions/memo";
import type { Department } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments, useDivisions } from "../hooks";
import { ChevronsLeft, ChevronsRight, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

const ITEMS_PER_PAGE = 10;

function DepartmentsLoadingSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Departments</CardTitle>
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

export default function DepartmentsPage() {
  const { data: departments, loading: loadingDepts, mutate: mutateDepts } = useDepartments();
  const { data: divisions, loading: loadingDivs } = useDivisions();
  const { toast } = useToast();

  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return departments.slice(start, end);
  }, [departments, currentPage]);

  const totalPages = Math.ceil(departments.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (isDialogOpen && editingDepartment) {
      setSelectedDivisionId(editingDepartment.divisionId);
    } else if (isDialogOpen && !editingDepartment) {
      setSelectedDivisionId(undefined);
    }
  }, [isDialogOpen, editingDepartment]);
  
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    if (!name || !code || !selectedDivisionId) {
        toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
        return;
    }

    const departmentData = {
        id: editingDepartment?.id,
        name,
        code,
        divisionId: selectedDivisionId,
    }

    await saveDepartment(departmentData);
    await mutateDepts();
    
    toast({ title: "Success", description: `Department ${editingDepartment ? 'updated' : 'created'} successfully.` });
    
    setIsDialogOpen(false);
    setEditingDepartment(null);
    setSelectedDivisionId(undefined);
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setIsDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingDepartment(null);
    setIsDialogOpen(true);
  }

  const handleDelete = (department: Department) => {
    setDeletingDepartment(department);
    setIsAlertOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!deletingDepartment) return;

    const result = await deleteDepartment(deletingDepartment.id);

    if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
        toast({ title: "Success", description: "Department deleted successfully." });
        await mutateDepts();
    }
    
    setIsAlertOpen(false);
    setDeletingDepartment(null);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingDepartment(null);
      setSelectedDivisionId(undefined);
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
  
  const handleAlertClose = (open: boolean) => {
    if (!open) {
      setDeletingDepartment(null);
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


  const getDivisionName = (divisionId: string) => {
      return divisions.find(d => d.id === divisionId)?.name || 'N/A';
  }

  const divisionOptions = divisions.map(d => ({ value: d.id, label: d.name }));

  if (loadingDepts || loadingDivs) {
    return <DepartmentsLoadingSkeleton />;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Departments</CardTitle>
        <Button onClick={handleAddNew}>Add Department</Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedDepartments.map((department, index) => (
                <TableRow key={department.id}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{department.name}</TableCell>
                    <TableCell>{department.code}</TableCell>
                    <TableCell>{getDivisionName(department.divisionId)}</TableCell>
                    <TableCell className="text-right">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleEdit(department)}><Edit className="mr-2"/>Edit</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDelete(department)} className="text-destructive"><Trash2 className="mr-2"/>Delete</DropdownMenuItem>
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
    
    <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
        <DialogHeader>
            <DialogTitle>{editingDepartment ? "Edit Department" : "Add New Department"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={editingDepartment?.name} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Code</Label>
                <Input id="code" name="code" defaultValue={editingDepartment?.code} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="divisionId" className="text-right">Division</Label>
                <Combobox
                    options={divisionOptions}
                    value={selectedDivisionId}
                    onChange={setSelectedDivisionId}
                    placeholder="Select a division"
                    searchPlaceholder="Search divisions..."
                    className="col-span-3"
                />
            </div>
            </div>
            <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
            </DialogFooter>
        </form>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isAlertOpen} onOpenChange={handleAlertClose}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the department '{deletingDepartment?.name}'.
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
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    