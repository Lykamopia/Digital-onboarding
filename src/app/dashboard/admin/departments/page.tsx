
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
import { saveDepartment } from "@/app/actions/memo";
import type { Department } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments, useDivisions } from "../hooks";

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
  const { departments, loading: loadingDepts, mutate: mutateDepts } = useDepartments();
  const { data: divisions, loading: loadingDivs } = useDivisions();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | undefined>(undefined);

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
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setSelectedDivisionId(department.divisionId)
    setIsDialogOpen(true);
  }

  const handleAddNew = () => {
    setEditingDepartment(null);
    setSelectedDivisionId(undefined);
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((department) => (
              <TableRow key={department.id}>
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

