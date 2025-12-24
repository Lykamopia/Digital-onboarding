
"use client";

import { useState, useEffect } from "react";
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
import { saveOffice } from "@/app/actions/memo";
import type { Office, Department } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffices, useDepartments } from "../hooks";

type OfficeWithRelations = Office & { department: { name: string, division: { name: string } } };

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
  const { offices, loading: loadingOffices, mutate: mutateOffices } = useOffices();
  const { departments, loading: loadingDepts } = useDepartments();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | undefined>(undefined);

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
    
    toast({ title: "Success", description: `Office ${editingOffice ? 'updated' : 'created'} successfully.` });

    setIsDialogOpen(false);
    setEditingOffice(null);
    setSelectedDepartmentId(undefined);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setSelectedDepartmentId(office.departmentId);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingOffice(null);
    setSelectedDepartmentId(undefined);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setEditingOffice(null);
        setSelectedDepartmentId(undefined);
    }
    setIsDialogOpen(open);
  }

  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));

  if (loadingOffices || loadingDepts) {
    return <OfficesLoadingSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Offices</CardTitle>
        <Button onClick={handleAddNew}>Add Office</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(offices as OfficeWithRelations[]).map((office) => (
                <TableRow key={office.id}>
                  <TableCell>{office.name}</TableCell>
                  <TableCell>{office.code}</TableCell>
                  <TableCell>{office.department.name}</TableCell>
                  <TableCell>{office.department.division.name}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(office)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOffice ? "Edit Office" : "Add New Office"}</DialogTitle>
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
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
