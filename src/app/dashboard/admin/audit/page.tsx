
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { FullMemo, User, DateRange } from "@/lib/types";
import { getAuditMemos, getUsers } from "@/app/actions/memo";
import { useDebouncedCallback } from 'use-debounce';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Search, ChevronsLeft, ChevronsRight } from "lucide-react";
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { AnimatedContent } from "@/components/animated-content";
import { AnimatedTimeline } from "@/components/animated-timeline";
import { HoneycombLoader } from "@/components/honeycomb-loader";
import { Combobox } from "@/components/ui/combobox";

type FilterKey = 'sender' | 'recipient' | 'status';

export default function AuditPage() {
    const [allMemos, setAllMemos] = useState<FullMemo[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMemo, setSelectedMemo] = useState<FullMemo | null>(null);

    // Filtering State
    const [query, setQuery] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [filters, setFilters] = useState<Record<FilterKey, string>>({ sender: '', recipient: '', status: '' });
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [memos, users] = await Promise.all([getAuditMemos(), getUsers()]);
            setAllMemos(memos as FullMemo[]);
            setAllUsers(users);
            setLoading(false);
        };
        fetchData();
    }, []);

    const debouncedSetQuery = useDebouncedCallback(setQuery, 300);

    const filteredMemos = useMemo(() => {
        let memos = allMemos;

        if (query) {
            memos = memos.filter(m =>
                m.subject.toLowerCase().includes(query.toLowerCase()) ||
                m.memo_reference_number?.toLowerCase().includes(query.toLowerCase())
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
            memos = memos.filter(m => m.status === filters.status);
        }

        return memos;
    }, [allMemos, query, dateRange, filters]);

    const paginatedMemos = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredMemos.slice(start, end);
    }, [filteredMemos, currentPage]);
    
    const totalPages = Math.ceil(filteredMemos.length / ITEMS_PER_PAGE);

    const userOptions = useMemo(() => allUsers.map(u => ({ value: u.id, label: u.name })), [allUsers]);
    const statusOptions = useMemo(() => [
        { value: 'sent', label: 'Sent' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'archived', label: 'Archived' },
    ], []);


    const handleFilterChange = (key: FilterKey, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><HoneycombLoader /></div>;
    }

    return (
        <AnimatedContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Search by subject or reference..."
                                    className="pl-10"
                                    onChange={(e) => debouncedSetQuery(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                            </div>
                        </div>
                        <div className="border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>From</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedMemos.map(memo => (
                                        <TableRow
                                            key={memo.id}
                                            onClick={() => setSelectedMemo(memo)}
                                            className={cn("cursor-pointer", selectedMemo?.id === memo.id && "bg-muted/50")}
                                        >
                                            <TableCell>{memo.memo_reference_number}</TableCell>
                                            <TableCell>{memo.subject}</TableCell>
                                            <TableCell>{memo.from.name}</TableCell>
                                            <TableCell>{format(new Date(memo.createdAt), 'PPP')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                         <div className="flex justify-between items-center p-4">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronsLeft/> Previous</Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronsRight/></Button>
                            </div>
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="sticky top-4">
                       <div className="p-6">
                         <h3 className="text-lg font-semibold mb-4">Memo Activity Timeline</h3>
                         <div className="max-h-[75vh] overflow-y-auto pr-4">
                            {selectedMemo ? (
                                <AnimatedTimeline activities={selectedMemo.activity} />
                            ) : (
                                <div className="text-center text-muted-foreground pt-12">
                                    <p>Select a memo to view its audit trail.</p>
                                </div>
                            )}
                         </div>
                       </div>
                    </Card>
                </div>
            </div>
        </AnimatedContent>
    );
}
