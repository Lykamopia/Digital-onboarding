
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { FullMemo, User, DateRange, Label as LabelType } from "@/lib/types";
import { getAuditMemos, getUsers, getLabels } from "@/app/actions/memo";
import { useDebouncedCallback } from 'use-debounce';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Search, ChevronsLeft, ChevronsRight, X, Download, Loader2 } from "lucide-react";
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { AnimatedContent } from "@/components/animated-content";
import { AnimatedTimeline } from "@/components/animated-timeline";
import { HoneycombLoader } from "@/components/honeycomb-loader";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LabelSelector } from "@/components/label-selector";
import Papa from "papaparse";
import { toast } from "sonner";

type FilterKey = 'sender' | 'recipient' | 'status';

export default function AuditPage() {
    const [data, setData] = useState<{ memos: FullMemo[], total: number, totalPages: number } | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allLabels, setAllLabels] = useState<LabelType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMemo, setSelectedMemo] = useState<FullMemo | null>(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [filters, setFilters] = useState<Record<FilterKey, string>>({ sender: '', recipient: '', status: '' });
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    useEffect(() => {
        const fetchFilterData = async () => {
            const [users, labels] = await Promise.all([getUsers(), getLabels()]);
            setAllUsers(users);
            setAllLabels(labels as LabelType[]);
        };
        fetchFilterData();
    }, []);

    const debouncedSearchTerm = useDebouncedCallback((value) => {
        setSearchTerm(value);
        setCurrentPage(1);
    }, 500);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getAuditMemos(currentPage, ITEMS_PER_PAGE, {
                query: searchTerm,
                sender: filters.sender,
                recipient: filters.recipient,
                status: filters.status,
                labels: selectedLabels,
                dateRange: dateRange ? { from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() } : undefined,
            });
            setData(result as any);
        } catch (error) {
            toast.error("Failed to fetch audit logs.");
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, filters, selectedLabels, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const clearFilters = () => {
        setSearchTerm('');
        setDateRange(undefined);
        setFilters({ sender: '', recipient: '', status: '' });
        setSelectedLabels([]);
        setCurrentPage(1);
    }

    const userOptions = useMemo(() => allUsers.map(u => ({ value: u.id, label: u.name })), [allUsers]);
    const statusOptions = useMemo(() => [
        { value: 'sent', label: 'Sent' },
        { value: 'acknowledged', label: 'Acknowledged' },
        { value: 'archived', label: 'Archived' },
    ], []);

    const handleFilterChange = (key: FilterKey, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleLabelChange = (labels: LabelType[]) => {
        setSelectedLabels(labels.map(l => l.id));
        setCurrentPage(1);
    }
    
    const handleExport = () => {
        if (!data || data.memos.length === 0) {
            return;
        }
        const dataToExport = data.memos.map(memo => ({
            "Reference No": memo.memo_reference_number,
            "Subject": memo.subject,
            "From": memo.from.name,
            "To": memo.to.map(u => u.name).join(', '),
            "CC": memo.cc.map(u => u.name).join(', '),
            "Date": format(new Date(memo.createdAt), 'PPP p'),
            "Status": memo.status,
            "Acknowledged": (memo.acknowledgedBy?.length ?? 0) > 0 ? 'Yes' : 'No',
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `memo_audit_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (allUsers.length === 0) {
        return <div className="flex h-64 items-center justify-center"><HoneycombLoader /></div>;
    }

    return (
        <AnimatedContent>
            <Card>
                <div className="p-4 space-y-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by subject or reference..."
                            className="w-full pl-8 pr-8"
                            defaultValue={searchTerm}
                            onChange={(e) => debouncedSearchTerm(e.target.value)}
                        />
                        {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Combobox options={userOptions} value={filters.sender} onChange={(v) => handleFilterChange('sender', v)} placeholder="Filter by Sender" searchPlaceholder="Search sender..." />
                        <Combobox options={userOptions} value={filters.recipient} onChange={(v) => handleFilterChange('recipient', v)} placeholder="Filter by Recipient" searchPlaceholder="Search recipient..." />
                        <Combobox options={statusOptions} value={filters.status} onChange={(v) => handleFilterChange('status', v)} placeholder="Filter by Status" />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                                        <>
                                            {format(dateRange.from, "LLL dd, y")} -{" "}
                                            {format(dateRange.to, "LLL dd, y")}
                                        </>
                                        ) : (
                                        format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Filter by date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={(range) => { setDateRange(range); setCurrentPage(1); }}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                         <div className="lg:col-span-4">
                            <LabelSelector allLabels={allLabels} selected={allLabels.filter(l => selectedLabels.includes(l.id))} setSelected={handleLabelChange} placeholder="Filter by labels..."/>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground hover:text-foreground"><X className="mr-2 h-4 w-4"/> Clear All Filters</Button>
                        <Button variant="outline" onClick={handleExport} disabled={!data || data.memos.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Export Results
                        </Button>
                    </div>
                </div>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><div className="h-8 w-full animate-pulse bg-muted rounded-md" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : data && data.memos.length > 0 ? data.memos.map((memo, index) => (
                                    <TableRow
                                        key={memo.id}
                                        onClick={() => setSelectedMemo(memo)}
                                        className="cursor-pointer"
                                    >
                                        <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                                        <TableCell>{memo.memo_reference_number}</TableCell>
                                        <TableCell>{memo.subject}</TableCell>
                                        <TableCell>{memo.from.name}</TableCell>
                                        <TableCell>{format(new Date(memo.createdAt), 'PPP')}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No memos found matching your criteria.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <div className="flex justify-between items-center p-4">
                    <div className="text-sm text-muted-foreground">
                        Showing {data?.memos.length ?? 0} of {data?.total ?? 0} results.
                    </div>
                    {data && data.totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Page {data.page} of {data.totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronsLeft/> Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(data.totalPages, p + 1))} disabled={currentPage === data.totalPages}>Next <ChevronsRight/></Button>
                        </div>
                    )}
                </div>
            </Card>

            <Dialog open={!!selectedMemo} onOpenChange={(isOpen) => !isOpen && setSelectedMemo(null)}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    {selectedMemo && (
                        <>
                        <DialogHeader>
                            <DialogTitle>{selectedMemo.subject}</DialogTitle>
                            <DialogDescription>
                                Audit trail for memo #{selectedMemo.memo_reference_number}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto pr-4 -mr-6">
                            <AnimatedTimeline activities={selectedMemo.activity} />
                        </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AnimatedContent>
    );
}
