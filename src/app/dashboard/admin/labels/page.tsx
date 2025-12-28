
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsLeft, ChevronsRight, MoreHorizontal, Trash2, Edit, PlusCircle, Palette, Tag } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useLabels } from "../hooks";
import { saveLabel, deleteLabel } from "@/app/actions/memo";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { Label as LabelType } from "@/lib/types";

const ITEMS_PER_PAGE = 10;
const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];


function LabelsLoadingSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Labels</CardTitle>
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

export default function LabelsPage() {
    const { data: labels, loading, mutate } = useLabels();
    const { toast } = useToast();

    const [editingLabel, setEditingLabel] = useState<Partial<LabelType> | null>(null);
    const [deletingLabel, setDeletingLabel] = useState<LabelType | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);

    useEffect(() => {
        if (editingLabel) {
            setSelectedColor(editingLabel.color || COLORS[0]);
        } else {
            setSelectedColor(COLORS[0]);
        }
    }, [editingLabel]);

    const paginatedLabels = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return labels.slice(start, end);
    }, [labels, currentPage]);

    const totalPages = Math.ceil(labels.length / ITEMS_PER_PAGE);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;

        if (!name) {
            toast({ title: "Error", description: "Label name is required.", variant: "destructive" });
            return;
        }

        const labelData = {
            id: editingLabel?.id,
            name,
            color: selectedColor,
            type: editingLabel?.type || 'USER',
        };

        const result = await saveLabel(labelData);
        if (result.error) {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
            await mutate();
            toast({ title: "Success", description: `Label ${editingLabel?.id ? 'updated' : 'created'} successfully.` });
            setIsDialogOpen(false);
            setEditingLabel(null);
        }
    };
    
    const handleDelete = async () => {
        if (!deletingLabel) return;

        const result = await deleteLabel(deletingLabel.id);
        if (result.error) {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
            await mutate();
            toast({ title: "Success", description: "Label deleted successfully." });
        }
        setIsAlertOpen(false);
        setDeletingLabel(null);
    };

    if (loading) {
        return <LabelsLoadingSkeleton />;
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Labels</CardTitle>
                    <Button onClick={() => { setEditingLabel(null); setIsDialogOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Label
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Preview</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLabels.map(label => (
                                    <TableRow key={label.id}>
                                        <TableCell>
                                            <span 
                                                className="px-2 py-1 rounded-full text-xs font-medium text-white" 
                                                style={{ backgroundColor: label.color }}
                                            >
                                                {label.name}
                                            </span>
                                        </TableCell>
                                        <TableCell>{label.name}</TableCell>
                                        <TableCell>
                                            <span className={cn("px-2 py-0.5 rounded text-xs", label.type === 'SYSTEM' ? "bg-gray-200 text-gray-800" : "bg-blue-100 text-blue-800")}>
                                                {label.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => { setEditingLabel(label); setIsDialogOpen(true); }}><Edit className="mr-2"/>Edit</DropdownMenuItem>
                                                    {label.type !== 'SYSTEM' && (
                                                        <DropdownMenuItem onSelect={() => { setDeletingLabel(label); setIsAlertOpen(true); }} className="text-destructive"><Trash2 className="mr-2"/>Delete</DropdownMenuItem>
                                                    )}
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLabel?.id ? "Edit Label" : "Add New Label"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input id="name" name="name" defaultValue={editingLabel?.name} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Color</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="col-span-3 justify-start">
                                            <div className="w-5 h-5 rounded-full mr-2" style={{ backgroundColor: selectedColor }} />
                                            {selectedColor}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <div className="grid grid-cols-6 gap-2 p-2">
                                            {COLORS.map(color => (
                                                <Button
                                                    key={color}
                                                    variant="outline"
                                                    size="icon"
                                                    className="w-8 h-8 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => setSelectedColor(color)}
                                                >
                                                    {selectedColor === color && <Check className="h-4 w-4 text-white" />}
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the label '{deletingLabel?.name}'.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingLabel(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
