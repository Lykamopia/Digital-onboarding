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
import { getAllMemosForAdmin, performBulkArchiveActions, performBulkArchive, getMemosToArchiveCount } from "@/app/actions/memo";
import type { Memo, DateRange } from "@/lib/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/data";
import { ChevronDown, ArchiveRestore, Trash2, Archive, Loader2, ChevronsLeft, ChevronsRight, Calendar as CalendarIcon, Search, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type MemoWithRelations = Memo & { from: { name: string }, to: { name: string }[], archivedBy: { id: string }[] };

const ITEMS_PER_PAGE = 10;

function ArchiveLoadingSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function ArchiveSettingsPage() {
  const [memos, setMemos] = useState<MemoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemos, setSelectedMemos] = useState<string[]>([]);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Bulk Archive by Date states
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = useState(false);
  const [isArchivingByDate, setIsArchivingByDate] = useState(false);
  const [memosToArchiveCount, setMemosToArchiveCount] = useState<number | null>(null);
  const [isFetchingCount, setIsFetchingCount] = useState(false);

  const filteredMemos = useMemo(() => {
      return memos.filter(memo => memo.archivedBy.length > 0)
  }, [memos]);

  const paginatedMemos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredMemos.slice(start, end);
  }, [filteredMemos, currentPage]);

  const totalPages = Math.ceil(filteredMemos.length / ITEMS_PER_PAGE);

  const fetchMemos = async () => {
    setLoading(true);
    const memosData = await getAllMemosForAdmin();
    setMemos(memosData as MemoWithRelations[]);
    setLoading(false);
  };
  
  useEffect(() => {
    fetchMemos();
  }, []);

  const handleFetchCount = async () => {
    if (!dateRange?.from) return;
    setIsFetchingCount(true);
    setMemosToArchiveCount(null);
    try {
        const count = await getMemosToArchiveCount(dateRange);
        setMemosToArchiveCount(count);
        if (count === 0) {
            toast.info("No Memos Found", { description: "There are no unarchived memos in the selected timeframe."});
        }
    } catch (error) {
        toast.error("Failed to get count", { description: "Could not fetch the number of memos to be archived." });
        setMemosToArchiveCount(null);
    } finally {
        setIsFetchingCount(false);
    }
  }

  const handleBulkAction = async (action: 'restore' | 'delete') => {
      if (selectedMemos.length === 0) {
          toast.error("No Memos Selected", { description: "Please select memos to perform this action." });
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
          await fetchMemos();
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
          await fetchMemos();
      } else {
          toast.error("Action Failed", { description: result.error });
      }
      setIsPerformingAction(false);
  }

    const handleBulkArchiveExecution = async () => {
        if (!dateRange?.from) {
            toast.error("No Date Range Selected");
            return;
        }
        setIsArchivingByDate(true);
        const result = await performBulkArchive(dateRange);
        if (result.success && result.summary) {
            toast.success("Bulk Archive Successful", { 
                description: `${result.summary.archived} memos archived. ${result.summary.skipped} already fully archived.`
            });
            setMemosToArchiveCount(null);
            setDateRange(undefined);
            await fetchMemos();
        } else {
            toast.error("Bulk Archive Failed", { description: result.error });
        }
        setIsArchivingByDate(false);
        setIsArchiveAlertOpen(false);
    }

    const handleDialogChange = (open: boolean, handler: (isOpen: boolean) => void) => {
        handler(open);
        if (!open) {
            setTimeout(() => {
                document.body.style.pointerEvents = 'auto';
            }, 500);
        }
    };

    const getDateLabel = () => {
        if (!dateRange?.from) return <span>Pick a date or range</span>;
        const isSingleDay = !dateRange.to || isSameDay(dateRange.from, dateRange.to);
        if (isSingleDay) return format(dateRange.from, "PPP");
        return `${format(dateRange.from, "LLL dd")} - ${format(dateRange.to!, "LLL dd, y")}`;
    }

  if (loading) {
    return <ArchiveLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
            <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                <CardTitle>Bulk Archive Tool</CardTitle>
            </div>
            <CardDescription>
                System-wide maintenance: Archive unarchived memos within a specific timeframe for all participants.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full sm:w-[320px] justify-start text-left font-normal bg-background", !dateRange && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {getDateLabel()}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 flex bg-card" align="start">
                        <div className="flex flex-col space-y-1 border-r border-border bg-muted/30 p-2 min-w-[120px]">
                            <div className="flex p-1 bg-muted rounded-md mb-2">
                                <Button 
                                    variant={dateMode === 'single' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="flex-1 text-xs h-7 px-2"
                                    onClick={() => setDateMode('single')}
                                >
                                    Single
                                </Button>
                                <Button 
                                    variant={dateMode === 'range' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="flex-1 text-xs h-7 px-2"
                                    onClick={() => setDateMode('range')}
                                >
                                    Range
                                </Button>
                            </div>
                        </div>
                        <Calendar
                            initialFocus
                            mode={dateMode}
                            selected={dateMode === 'range' ? dateRange : (dateRange?.from || undefined)}
                            onSelect={(val: any) => {
                                if (dateMode === 'single') {
                                    setDateRange(val ? { from: val, to: val } : undefined);
                                } else {
                                    setDateRange(val);
                                }
                                setMemosToArchiveCount(null);
                            }}
                            numberOfMonths={1}
                            disabled={(date) => date > new Date()}
                        />
                    </PopoverContent>
                </Popover>
                <Button variant="secondary" onClick={handleFetchCount} disabled={!dateRange?.from || isFetchingCount}>
                    {isFetchingCount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Preview Dataset
                </Button>
                <Button onClick={() => setIsArchiveAlertOpen(true)} disabled={!dateRange?.from || isArchivingByDate || memosToArchiveCount === null || memosToArchiveCount === 0}>
                     {isArchivingByDate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                    Execute Archive
                </Button>
            </div>
            <AnimatePresence>
                {memosToArchiveCount !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                            "p-4 rounded-md border border-dashed text-center flex flex-col items-center gap-1",
                            memosToArchiveCount > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20" : "bg-muted/50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {memosToArchiveCount > 0 ? <AlertCircle className="h-5 w-5 text-amber-500" /> : <Info className="h-5 w-5 text-muted-foreground" />}
                            <p className="font-semibold text-lg">{memosToArchiveCount} unarchived memos</p>
                        </div>
                        <p className="text-sm text-muted-foreground">found in the selected timeframe will be processed for all participants.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Management Console</CardTitle>
          <CardDescription>
            Manually restore or permanently delete archived memos across the system.
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
                       <ArchiveRestore className="mr-2 h-4 w-4" /> Restore to Inbox
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
                  <TableHead>Archive Date</TableHead>
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
                      <TableCell className="font-medium max-w-xs truncate">{memo.subject}</TableCell>
                      <TableCell>{memo.from.name}</TableCell>
                      <TableCell>{formatTimestamp(memo.updatedAt, false)}</TableCell>
                       <TableCell>
                          <Badge variant="secondary">Archived</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
      
       <AlertDialog open={isDeleteAlertOpen} onOpenChange={(open) => handleDialogChange(open, setIsDeleteAlertOpen)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is irreversible. This will permanently delete the selected {selectedMemos.length} memo(s), including all attachments and activity logs.
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

        <AlertDialog open={isArchiveAlertOpen} onOpenChange={(open) => handleDialogChange(open, setIsArchiveAlertOpen)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Bulk Archive</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive <strong>{memosToArchiveCount} unarchived memo(s)</strong> within the timeframe <strong>{getDateLabel()}</strong> for all participants.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isArchivingByDate}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkArchiveExecution} disabled={isArchivingByDate}>
                  {isArchivingByDate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm & Process'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
