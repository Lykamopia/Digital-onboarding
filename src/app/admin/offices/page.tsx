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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { offices as initialOffices, departments, divisions } from "@/lib/data";
import type { Office } from "@/lib/types";

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>(initialOffices);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const officeData: Office = {
      id: editingOffice ? editingOffice.id : `off-${Date.now()}`,
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      departmentId: formData.get("departmentId") as string,
    };

    if (editingOffice) {
      setOffices(offices.map((o) => (o.id === editingOffice.id ? officeData : o)));
    } else {
      setOffices([...offices, officeData]);
    }

    setIsDialogOpen(false);
    setEditingOffice(null);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingOffice(null);
    setIsDialogOpen(true);
  };

  const getDepartmentInfo = (departmentId: string) => {
    const dept = departments.find((d) => d.id === departmentId);
    if (!dept) return { name: "N/A", division: "N/A" };
    const div = divisions.find((d) => d.id === dept.divisionId);
    return { name: dept.name, division: div?.name || "N/A" };
  };

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
            {offices.map((office) => {
              const deptInfo = getDepartmentInfo(office.departmentId);
              return (
                <TableRow key={office.id}>
                  <TableCell>{office.name}</TableCell>
                  <TableCell>{office.code}</TableCell>
                  <TableCell>{deptInfo.name}</TableCell>
                  <TableCell>{deptInfo.division}</TableCell>
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
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  <Select name="departmentId" defaultValue={editingOffice?.departmentId}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
