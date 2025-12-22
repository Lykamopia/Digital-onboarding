
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { departments as initialDepartments, divisions } from "@/lib/data";
import type { Department } from "@/lib/types";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | undefined>(undefined);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const departmentData: Department = {
        id: editingDepartment ? editingDepartment.id : `dept-${Date.now()}`,
        name: formData.get('name') as string,
        code: formData.get('code') as string,
        divisionId: selectedDivisionId || '',
    }

    if (editingDepartment) {
        setDepartments(departments.map(d => d.id === editingDepartment.id ? departmentData : d));
    } else {
        setDepartments([...departments, departmentData]);
    }
    
    setIsDialogOpen(false);
    setEditingDepartment(null);
    setSelectedDivisionId(undefined);
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
