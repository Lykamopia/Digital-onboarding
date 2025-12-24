
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
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/data";
import { ChevronDown, ArchiveRestore, Trash2, Archive, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type MemoWithRelations = Memo & { from: { name: string }, to: { name: string }[], archivedBy: { id: string }[] };

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
  const { toast } = useToast();

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
    setIsSaving(true);
    const result = await saveArchiveSettings(settings.autoArchiveDays);
    if(result.success) {
      toast({ title: "Settings Saved", description: "Auto-archive settings have been updated." });
    } else {
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    }
    setIsSaving(false);
  };
  
  const handleBulkAction = async (action: 'archive' | 'restore' | 'delete') => {
      if (selectedMemos.length === 0) {
          toast({ title: "No Memos Selected", description: "Please select memos to perform this action.", variant: "destructive" });
          return;
      }

      if (action === 'delete') {
          setIsDeleteAlertOpen(true);
          return;
      }
      
      setIsPerformingAction(true);
      const result = await performBulkArchiveActions(action, selectedMemos);
      if (result.success) {
          toast({ title: "Action Successful", description: `Selected memos have been ${action === 'archive' ? 'archived' : 'restored'}.`});
          setSelectedMemos([]);
          await fetchMemosAndSettings();
      } else {
          toast({ title: "Action Failed", description: result.error, variant: "destructive" });
      }
      setIsPerformingAction(false);
  }

  const handleDeleteConfirm = async () => {
      setIsPerformingAction(true);
      setIsDeleteAlertOpen(false);
      const result = await performBulkArchiveActions('delete', selectedMemos);
       if (result.success) {
          toast({ title: "Memos Deleted", description: "Selected memos have been permanently deleted."});
          setSelectedMemos([]);
          await fetchMemosAndSettings();
      } else {
          toast({ title: "Action Failed", description: result.error, variant: "destructive" });
      }
      setIsPerformingAction(false);
  }

  const filteredMemos = useMemo(() => {
      return memos.filter(memo => memo.archivedBy.length > 0)
  }, [memos]);

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
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                        Bulk Actions <ChevronDown className="ml-2 h-4 w-4" />
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
                  <TableHead padding="checkbox" className="w-12">
                    <Checkbox
                      checked={selectedMemos.length > 0 && selectedMemos.length === filteredMemos.length}
                      onCheckedChange={(checked) => {
                        setSelectedMemos(checked ? filteredMemos.map((m) => m.id) : []);
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Archived On</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemos.length > 0 ? (
                  filteredMemos.map((memo) => (
                    <TableRow key={memo.id} data-state={selectedMemos.includes(memo.id) && "selected"}>
                      <TableCell padding="checkbox">
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
                    <TableCell colSpan={5} className="h-24 text-center">
                      No archived memos found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
