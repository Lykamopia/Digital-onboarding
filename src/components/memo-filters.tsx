

'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Search, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams } from '@/hooks/use-search-params';
import { useDebouncedCallback } from 'use-debounce';
import { cn } from '@/lib/utils';

interface MemoFiltersProps {
  tab: string;
  search: string;
  setSearch: (search: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
  status: string;
  setStatus: (status: string) => void;
  toggle: React.ReactNode;
  isExpanded: boolean;
}

export function MemoFilters({ tab, search, setSearch, dateRange, setDateRange, status, setStatus, toggle, isExpanded }: MemoFiltersProps) {
  const { setSearchParams } = useSearchParams();

  const debouncedSetSearch = useDebouncedCallback((value) => {
    setSearchParams({ q: value });
  }, 300);

  const handleDateChange = (date: DateRange | undefined) => {
      setDateRange(date);
      setSearchParams({ 
        from: date?.from ? format(date.from, 'yyyy-MM-dd') : null,
        to: date?.to ? format(date.to, 'yyyy-MM-dd') : null
       });
  }

  const handleStatusChange = (newStatus: string) => {
      setStatus(newStatus);
      setSearchParams({ status: newStatus === 'all' ? null : newStatus });
  }

  const clearFilters = () => {
    setSearch('');
    setDateRange(undefined);
    setStatus('');
    setSearchParams({ q: null, from: null, to: null, status: null });
  }

  const hasActiveFilters = search || dateRange || status;

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
        </div>
      {isExpanded && (
        <div className="flex min-w-0 items-center flex-wrap gap-2 mt-2">
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
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateChange}
                numberOfMonths={2}
                />
            </PopoverContent>
            </Popover>
            {tab === 'inbox' && (
                <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-auto flex-1">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
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
      )}
    </div>
  );
}
