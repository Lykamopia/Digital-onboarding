
"use client";

import { useState, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useDivisions } from "../hooks";
import { ChevronsLeft, ChevronsRight, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";


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
  const { toast } = useToast();
  
  const [editingDivision, setEditingDivision] = useState<Partial<Division> | null>(null);
  const [deletingDivision, setDeletingDivision] = useState<Division | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedDivisions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return divisions.slice(start, end);
  }, [divisions, currentPage]);

  const totalPages = Math.ceil(divisions.length / ITEMS_PER_PAGE);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    
    if (!name || !code) {
        toast({ title: "Error", description: "Name and code are required.", variant: "destructive" });
        return;
    }

    const divisionData = {
        id: editingDivision?.id,
        name,
        code,
    }

    await saveDivision(divisionData);
    await mutate();

    toast({ title: "Success", description: `Division ${editingDivision?.id ? 'updated' : 'created'} successfully.` });
    
    setIsDialogOpen(false);
    setEditingDivision(null);
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

    const result = await deleteDivision(deletingDivision.id);
    if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
        toast({ title: "Success", description: "Division deleted successfully." });
        await mutate();
    }
    
    setIsAlertOpen(false);
    setDeletingDivision(null);
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingDivision(null);
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
      setDeletingDivision(null);
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

  if (loading) {
    return <DivisionsLoadingSkeleton />;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Divisions</CardTitle>
        <Button onClick={handleAddNew}>Add Division</Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedDivisions.map((division, index) => (
                <TableRow key={division.id}>
                    <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{division.name}</TableCell>
                    <TableCell>{division.code}</TableCell>
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
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={editingDivision?.name} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Code</Label>
                <Input id="code" name="code" defaultValue={editingDivision?.code} className="col-span-3" />
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
                    This action cannot be undone. This will permanently delete the division '{deletingDivision?.name}'.
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

    