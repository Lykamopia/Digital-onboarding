
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
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllMemosForAdmin, getArchiveSettings, saveArchiveSettings, performBulkArchiveActions } from "@/app/actions/memo";
import type { Memo } from "@/lib/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/data";
import { ChevronDown, ArchiveRestore, Trash2, Archive, Loader2, ChevronsLeft, ChevronsRight, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type MemoWithRelations = Memo & { from: { name: string }, to: { name: string }[], archivedBy: { id: string }[] };

const ITEMS_PER_PAGE = 10;

function ArchiveLoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function ArchiveSettingsPage() {
  const [memos, setMemos] = useState<MemoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ autoArchiveDays: 90 });
  const [selectedMemos, setSelectedMemos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredMemos = useMemo(() => {
      return memos.filter(memo => memo.archivedBy.length > 0)
  }, [memos]);

  const paginatedMemos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredMemos.slice(start, end);
  }, [filteredMemos, currentPage]);

  const totalPages = Math.ceil(filteredMemos.length / ITEMS_PER_PAGE);

  const fetchMemosAndSettings = async () => {
    setLoading(true);
    const [memosData, settingsData] = await Promise.all([
      getAllMemosForAdmin(),
      getArchiveSettings(),
    ]);
    setMemos(memosData as MemoWithRelations[]);
    setSettings(settingsData);
    setLoading(false);
  };
  
  useEffect(() => {
    fetchMemosAndSettings();
  }, []);

  const handleSaveSettings = async () => {
    if (settings.autoArchiveDays < 1) {
        toast.error("Invalid Value", { description: "Auto-archive period must be at least 1 day." });
        return;
    }
    setIsSaving(true);
    const result = await saveArchiveSettings(settings.autoArchiveDays);
    if(result.success) {
      toast.success("Settings Saved", { description: "Auto-archive settings have been updated." });
    } else {
      toast.error("Error", { description: result.error || "Could not save settings." });
    }
    setIsSaving(false);
  };
  
  const handleBulkAction = async (action: 'restore' | 'delete') => {
      if (selectedMemos.length === 0) {
          toast.warning("No Memos Selected", { description: "Please select memos to perform this action." });
          return;
      }

      if (action === 'delete') {
          setIsDeleteAlertOpen(true);
          return;
      }
      
      setIsPerformingAction(true);
      const result = await performBulkArchiveActions(action, selectedMemos);
      if (result.success) {
          toast.success("Action Successful", { description: `Selected memos have been restored.`});
          setSelectedMemos([]);
          await fetchMemosAndSettings();
      } else {
          toast.error("Action Failed", { description: result.error });
      }
      setIsPerformingAction(false);
  }

  const handleDeleteConfirm = async () => {
      setIsPerformingAction(true);
      setIsDeleteAlertOpen(false);
      const result = await performBulkArchiveActions('delete', selectedMemos);
       if (result.success) {
          toast.success("Memos Deleted", { description: "Selected memos have been permanently deleted."});
          setSelectedMemos([]);
          await fetchMemosAndSettings();
      } else {
          toast.error("Action Failed", { description: result.error });
      }
      setIsPerformingAction(false);
  }

  if (loading) {
    return <ArchiveLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auto-Archive Settings</CardTitle>
          <CardDescription>
            Define rules to automatically archive memos after a certain period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="archive-days" className="whitespace-nowrap">
              Archive memos older than
            </Label>
            <Input
              id="archive-days"
              type="number"
              value={settings.autoArchiveDays}
              onChange={(e) => setSettings({ autoArchiveDays: Number(e.target.value) })}
              className="w-24"
              min="1"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Archived Memos</CardTitle>
          <CardDescription>
            Manually manage all archived memos. Actions taken here are permanent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={selectedMemos.length === 0 || isPerformingAction}>
                        <Archive className="mr-2 h-4 w-4" /> Bulk Actions <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => handleBulkAction('restore')}>
                       <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleBulkAction('delete')} className="text-destructive" data-destructive>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {isPerformingAction && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            <span className="text-sm text-muted-foreground ml-auto">{selectedMemos.length} selected</span>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedMemos.length > 0 && selectedMemos.length === paginatedMemos.length && paginatedMemos.length > 0}
                      onCheckedChange={(checked) => {
                        setSelectedMemos(checked ? paginatedMemos.map((m) => m.id) : []);
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Archived On</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMemos.length > 0 ? (
                  paginatedMemos.map((memo, index) => (
                    <TableRow key={memo.id} data-state={selectedMemos.includes(memo.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedMemos.includes(memo.id)}
                          onCheckedChange={(checked) => {
                            setSelectedMemos((prev) =>
                              checked ? [...prev, memo.id] : prev.filter((id) => id !== memo.id)
                            );
                          }}
                          aria-label={`Select memo ${memo.subject}`}
                        />
                      </TableCell>
                       <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                      <TableCell className="font-medium">{memo.subject}</TableCell>
                      <TableCell>{memo.from.name}</TableCell>
                      <TableCell>{formatTimestamp(memo.updatedAt, false)}</TableCell>
                       <TableCell>
                          <Badge variant="secondary">Archived</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No archived memos found.
                    </TableCell>
                  </TableRow>
                )}
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
      
       <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the selected {selectedMemos.length} memo(s) and all related data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
