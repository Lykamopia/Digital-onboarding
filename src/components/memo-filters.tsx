
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Search, X, RefreshCw, Loader2, List, Mail, MailOpen, CheckCircle2, Eye, Star, Flag } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams } from '@/hooks/use-search-params';
import { useDebouncedCallback } from 'use-debounce';
import { cn } from '@/lib/utils';
import { LabelSelector } from '@/components/label-selector';
import type { Label as LabelType } from '@/lib/types';
import { Separator } from './ui/separator';


interface MemoFiltersProps {
  tab: string;
  search: string;
  setSearch: (search: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
  status: string;
  setStatus: (status: string) => void;
  allLabels: LabelType[];
  selectedLabels: string[];
  setSelectedLabels: (labels: string[]) => void;
  show: string;
  setShow: (show: string) => void;
  toggle: React.ReactNode;
  isExpanded: boolean;
  onRefresh: () => void;
  loading: boolean;
}

export function MemoFilters({ 
    tab, search, setSearch, dateRange, setDateRange, 
    status, setStatus, allLabels, selectedLabels, 
    setSelectedLabels, show, setShow, toggle, isExpanded, onRefresh, loading 
}: MemoFiltersProps) {
  const { setSearchParams } = useSearchParams();

  const debouncedSetSearch = useDebouncedCallback((value) => {
    setSearchParams({ q: value });
  }, 300);

  const handleDateChange = (range: DateRange | undefined) => {
      setDateRange(range);
      setSearchParams({ 
        from: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
        to: range?.to ? format(range.to, 'yyyy-MM-dd') : null
       });
  }

  const setQuickDate = (range: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'lastYear') => {
    const now = new Date();
    let from: Date;
    let to: Date | undefined = undefined;

    switch(range) {
        case 'today':
            from = startOfDay(now);
            to = endOfDay(now);
            break;
        case 'yesterday':
            const yesterday = subYears(now, 0);
            yesterday.setDate(now.getDate() - 1);
            from = startOfDay(yesterday);
            to = endOfDay(yesterday);
            break;
        case 'thisWeek':
            from = startOfWeek(now);
            to = endOfWeek(now);
            break;
        case 'thisMonth':
            from = startOfMonth(now);
            to = endOfMonth(now);
            break;
        case 'thisYear':
            from = startOfYear(now);
            to = endOfYear(now);
            break;
        case 'lastYear':
            const lastYearDate = subYears(now, 1);
            from = startOfYear(lastYearDate);
            to = endOfYear(lastYearDate);
            break;
    }
    setDateRange({ from, to });
    setSearchParams({ 
      from: from.toISOString(),
      to: to?.toISOString() ?? from.toISOString()
     });
  };


  const handleStatusChange = (newStatus: string) => {
      setStatus(newStatus);
      setSearchParams({ status: newStatus === 'all' ? null : newStatus });
  }
  
  const handleLabelChange = (newLabels: LabelType[]) => {
      const labelIds = newLabels.map(l => l.id);
      setSelectedLabels(labelIds);
      setSearchParams({ labels: labelIds.length > 0 ? labelIds.join(',') : null });
  }

  const handleShowChange = (newShow: string) => {
      setShow(newShow);
      setSearchParams({ show: newShow === 'all' ? null : newShow });
  }

  const clearFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setStatus('');
    setSelectedLabels([]);
    setShow('');
    setSearchParams({ q: null, from: null, to: null, status: null, labels: null, show: null });
  }

  const hasActiveFilters = search || dateRange || status || selectedLabels.length > 0 || (show && tab !== 'favorites');
  
  const selectedLabelObjects = selectedLabels.map(id => {
      return allLabels.find(l => l.id === id);
  }).filter(Boolean) as LabelType[];


  return (
    <div className={cn("p-2 border-b", !isExpanded && "flex flex-col items-center")}>
        <div className='flex items-center gap-2 w-full'>
            {toggle}
             {isExpanded && (
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    type="search"
                    placeholder="Search memos..."
                    className="w-full rounded-lg bg-background pl-8"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        debouncedSetSearch(e.target.value);
                        }
                    }
                    />
                </div>
            )}
             <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} className="shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
        </div>
      {isExpanded && (
        <div className="flex min-w-0 flex-col gap-2 mt-2">
           <div className="flex items-center gap-2 flex-wrap">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-full sm:w-auto flex-1 justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                        dateRange.to ? (
                        <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                        </>
                        ) : (
                        format(dateRange.from, "LLL dd, y")
                        )
                    ) : (
                        <span>Pick a date</span>
                    )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex" align="start">
                    <div className="flex flex-col space-y-1 border-r p-2">
                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setQuickDate('today')}>Today</Button>
                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setQuickDate('yesterday')}>Yesterday</Button>
                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setQuickDate('thisWeek')}>This Week</Button>
                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setQuickDate('thisMonth')}>This Month</Button>
                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setQuickDate('thisYear')}>This Year</Button>
                        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setQuickDate('lastYear')}>Last Year</Button>
                    </div>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={handleDateChange}
                        numberOfMonths={1}
                        captionLayout="dropdown-buttons"
                        fromYear={new Date().getFullYear() - 10}
                        toYear={new Date().getFullYear() + 10}
                    />
                </PopoverContent>
            </Popover>
            {tab === 'inbox' && (
                <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-auto flex-1">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">
                        <div className="flex items-center gap-2">
                            <List className="h-4 w-4 text-muted-foreground" />
                            All Statuses
                        </div>
                    </SelectItem>
                    <SelectItem value="unread">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-green-500" />
                            Unread
                        </div>
                    </SelectItem>
                    <SelectItem value="read">
                        <div className="flex items-center gap-2">
                            <MailOpen className="h-4 w-4 text-blue-500" />
                            Read
                        </div>
                    </SelectItem>
                    <SelectItem value="acknowledged">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-purple-500" />
                            Acknowledged
                        </div>
                    </SelectItem>
                </SelectContent>
                </Select>
            )}
            {tab !== 'favorites' && (
                <Select value={show} onValueChange={handleShowChange}>
                    <SelectTrigger className="w-full sm:w-auto flex-1">
                        <SelectValue placeholder="Show" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                            <div className="flex items-center gap-2">
                               <Eye className="h-4 w-4 text-muted-foreground" />
                                Show All
                            </div>
                        </SelectItem>
                        <SelectItem value="favorites">
                            <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-yellow-500" />
                                Favorites
                            </div>
                        </SelectItem>
                        <SelectItem value="flagged">
                            <div className="flex items-center gap-2">
                                <Flag className="h-4 w-4 text-red-500" />
                                Flagged
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            )}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                    <X className="mr-1 h-4 w-4" />
                    Clear
                </Button>
            )}
           </div>
           <LabelSelector
              allLabels={allLabels}
              selected={selectedLabelObjects}
              setSelected={handleLabelChange}
              placeholder="Filter by labels..."
            />
        </div>
      )}
    </div>
  );
}

    