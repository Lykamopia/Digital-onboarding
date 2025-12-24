
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
import { saveDivision } from "@/app/actions/memo";
import type { Division } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useDivisions } from "../hooks";

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
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);

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

    toast({ title: "Success", description: `Division ${editingDivision ? 'updated' : 'created'} successfully.` });
    
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

  if (loading) {
    return <DivisionsLoadingSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Divisions</CardTitle>
        <Button onClick={handleAddNew}>Add Division</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {divisions.map((division) => (
              <TableRow key={division.id}>
                <TableCell>{division.name}</TableCell>
                <TableCell>{division.code}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(division)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDivision ? "Edit Division" : "Add New Division"}</DialogTitle>
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
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
