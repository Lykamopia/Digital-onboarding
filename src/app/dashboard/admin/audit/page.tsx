
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { FullMemo, User, DateRange, Label as LabelType } from "@/lib/types";
import { getAuditMemos, getUsers, getLabels } from "@/app/actions/memo";
import { useDebouncedCallback } from 'use-debounce';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Search, ChevronsLeft, ChevronsRight, X, Download } from "lucide-react";
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

type FilterKey = 'sender' | 'recipient' | 'status';

export default function AuditPage() {
    const [allMemos, setAllMemos] = useState<FullMemo[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allLabels, setAllLabels] = useState<LabelType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMemo, setSelectedMemo] = useState<FullMemo | null>(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [filters, setFilters] = useState<Record<FilterKey, string>>({ sender: '', recipient: '', status: '' });
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [memos, users, labels] = await Promise.all([getAuditMemos(), getUsers(), getLabels()]);
            setAllMemos(memos as FullMemo[]);
            setAllUsers(users);
            setAllLabels(labels as LabelType[]);
            setLoading(false);
        };
        fetchData();
    }, []);

    const filteredMemos = useMemo(() => {
        let memos = allMemos;

        if (appliedSearchTerm) {
            memos = memos.filter(m =>
                m.subject.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
                m.memo_reference_number?.toLowerCase().includes(appliedSearchTerm.toLowerCase())
            );
        }

        if (dateRange?.from) {
            memos = memos.filter(m => new Date(m.createdAt) >= dateRange.from!);
        }
        if (dateRange?.to) {
            memos = memos.filter(m => new Date(m.createdAt) <= dateRange.to!);
        }

        if (filters.sender) {
            memos = memos.filter(m => m.fromId === filters.sender);
        }
        if (filters.recipient) {
            memos = memos.filter(m => m.to.some(u => u.id === filters.recipient) || m.cc.some(u => u.id === filters.recipient));
        }
        if (filters.status) {
            memos = memos.filter(m => filters.status === 'acknowledged' 
                ? (m.acknowledgedBy?.length ?? 0) > 0 
                : m.status === filters.status);
        }

        if (selectedLabels.length > 0) {
            memos = memos.filter(m => 
                m.labels.some(label => selectedLabels.includes(label.id))
            );
        }

        return memos;
    }, [allMemos, appliedSearchTerm, dateRange, filters, selectedLabels]);
    
    const handleSearch = () => {
        setAppliedSearchTerm(searchTerm);
        setCurrentPage(1);
    }
    
    const clearFilters = () => {
        setSearchTerm('');
        setAppliedSearchTerm('');
        setDateRange(undefined);
        setFilters({ sender: '', recipient: '', status: '' });
        setSelectedLabels([]);
        setCurrentPage(1);
    }

    const paginatedMemos = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredMemos.slice(start, end);
    }, [filteredMemos, currentPage]);
    
    const totalPages = Math.ceil(filteredMemos.length / ITEMS_PER_PAGE);

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
        if (filteredMemos.length === 0) {
            return;
        }
        const dataToExport = filteredMemos.map(memo => ({
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

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><HoneycombLoader /></div>;
    }

    return (
        <AnimatedContent>
            <Card>
                <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search by subject or reference..."
                            className="flex-grow"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4"/> Search</Button>
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
                                    onSelect={setDateRange}
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
                        <Button variant="outline" onClick={handleExport} disabled={filteredMemos.length === 0}>
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
                                {paginatedMemos.length > 0 ? paginatedMemos.map((memo, index) => (
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
                        Showing {paginatedMemos.length} of {filteredMemos.length} results. Page {currentPage} of {totalPages}.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronsLeft/> Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronsRight/></Button>
                    </div>
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

    