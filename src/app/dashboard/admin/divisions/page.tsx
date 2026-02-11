
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
import { saveDivision, deleteDivision } from "@/app/actions/memo";
import type { Division } from "@/lib/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDivisions, useDepartments } from "../hooks";
import { ChevronsLeft, ChevronsRight, MoreHorizontal, Trash2, Edit, PlusCircle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Combobox } from "@/components/ui/combobox";


const ITEMS_PER_PAGE = 10;

function DivisionsLoadingSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Divisions</CardTitle>
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

export default function DivisionsPage() {
  const { data: divisions, loading, mutate } = useDivisions();
  const { data: departments, loading: loadingDepts } = useDepartments();
  
  const [editingDivision, setEditingDivision] = useState<Partial<Division> | null>(null);
  const [deletingDivision, setDeletingDivision] = useState<Division | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>(undefined);

  const paginatedDivisions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return divisions.slice(start, end);
  }, [divisions, currentPage]);

  const totalPages = Math.ceil(divisions.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (isDialogOpen && editingDivision) {
      setSelectedDepartmentId((editingDivision as Division).departmentId);
    } else if (isDialogOpen && !editingDivision) {
      setSelectedDepartmentId(undefined);
    }
  }, [isDialogOpen, editingDivision]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    
    if (!name || !code || !selectedDepartmentId) {
        toast.error("Error", { description: "All fields are required." });
        return;
    }

    const divisionData = {
        id: editingDivision?.id,
        name,
        code,
        departmentId: selectedDepartmentId,
    }

    setIsSaving(true);
    try {
      await saveDivision(divisionData);
      await mutate();
      toast.success("Success", { description: `Division ${editingDivision?.id ? 'updated' : 'created'} successfully.` });
      handleDialogChange(false);
    } catch (error: any) {
      toast.error("Error", { description: error?.message || 'Failed to save division.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleEdit = (division: Division) => {
    setEditingDivision(division);
    setIsDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingDivision(null);
    setIsDialogOpen(true);
  }

  const handleDelete = (division: Division) => {
    setDeletingDivision(division);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDivision) return;
    setIsDeleting(true);
    try {
      const result = await deleteDivision(deletingDivision.id);
      if (result && result.error) {
        toast.error("Error", { description: result.error });
      } else {
        toast.success("Success", { description: "Division deleted successfully." });
        await mutate();
      }
    } catch (error: any) {
      toast.error("Error", { description: error?.message || 'Failed to delete division.' });
    } finally {
      setIsDeleting(false);
      handleAlertChange(false);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setTimeout(() => { document.body.style.pointerEvents = 'auto'; }, 500);
      setEditingDivision(null);
      setSelectedDepartmentId(undefined);
    }
  }
  
  const handleAlertChange = (open: boolean) => {
    setIsAlertOpen(open);
    if (!open) {
      setTimeout(() => { document.body.style.pointerEvents = 'auto'; }, 500);
      setDeletingDivision(null);
    }
  }

  const getDepartmentName = (departmentId: string) => {
      return departments.find(d => d.id === departmentId)?.name || 'N/A';
  }

  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));

  if (loading || loadingDepts) {
    return <DivisionsLoadingSkeleton />;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Divisions</CardTitle>
        <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Division
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
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedDivisions.map((division, index) => (
                <TableRow key={division.id}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{division.name}</TableCell>
                    <TableCell>{division.code}</TableCell>
                    <TableCell>{getDepartmentName(division.departmentId)}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleEdit(division)}><Edit className="mr-2"/>Edit</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleDelete(division)} className="text-destructive"><Trash2 className="mr-2"/>Delete</DropdownMenuItem>
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

    <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
        <DialogHeader>
            <DialogTitle>{editingDivision?.id ? "Edit Division" : "Add New Division"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
            <fieldset disabled={isSaving}>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" defaultValue={editingDivision?.name} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">Code</Label>
                    <Input id="code" name="code" defaultValue={editingDivision?.code} className="col-span-3" />
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
            </fieldset>
            <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            </DialogFooter>
        </form>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isAlertOpen} onOpenChange={handleAlertChange}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the division '{deletingDivision?.name}'.
                </AlertDialogDescription>
            </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
