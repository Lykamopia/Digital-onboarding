
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { saveDepartment } from "@/app/actions/memo";
import type { Department } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments, useDivisions } from "../hooks";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setEditingDepartment(null);
        setSelectedDivisionId(undefined);
    }
    setIsDialogOpen(open);
  }

  const getDivisionName = (divisionId: string) => {
      return divisions.find(d => d.id === divisionId)?.name || 'N/A';
  }

  const divisionOptions = divisions.map(d => ({ value: d.id, label: d.name }));

  if (loadingDepts || loadingDivs) {
    return <DepartmentsLoadingSkeleton />;
  }

  return (
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
                    <Button variant="outline" size="sm" onClick={() => handleEdit(department)}>
                        Edit
                    </Button>
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
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
