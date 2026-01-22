
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Search, X, RefreshCw, Loader2, List, Mail, MailOpen, CheckCircle2, Eye, Star, Flag, CalendarDays, Rewind, CornerDownLeft, ChevronsRight, Book, BookCopy, Inbox, Users, Send, Reply, Share2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, isSameDay, subDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams } from '@/hooks/use-search-params';
import { useDebouncedCallback } from 'use-debounce';
import { cn } from '@/lib/utils';
import { LabelSelector } from '@/components/label-selector';
import type { DateRange, Label as LabelType } from '@/lib/types';
import { Separator } from './ui/separator';

const inboxFilterItems = [
    { value: 'all', label: 'All', icon: <Inbox /> },
    { value: 'direct', label: 'Direct', icon: <Mail /> },
    { value: 'cc', label: 'CC\'d', icon: <Users /> },
];

const sentFilterItems = [
    { value: 'all', label: 'All', icon: <Mail /> },
    { value: 'sent', label: 'Sent', icon: <Send /> },
    { value: 'replied', label: 'Replied', icon: <Reply /> },
    { value: 'assigned', label: 'Assigned', icon: <Share2 /> },
];

interface FilterTabsProps {
    items: { value: string; label: string; icon: React.ReactNode; }[];
    selected: string;
    onSelect: (value: string) => void;
}

const FilterTabs: React.FC<FilterTabsProps> = ({ items, selected, onSelect }) => {
    return (
        <div className="relative flex w-full items-center justify-start gap-2 rounded-lg bg-muted p-1">
            {items.map(item => (
                <button
                    key={item.value}
                    onClick={() => onSelect(item.value)}
                    className={cn(
                        "relative flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected === item.value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {selected === item.value && (
                        <motion.div
                            layoutId="activeFilterTab"
                            className="absolute inset-0 z-0 rounded-md bg-primary"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {item.icon} {item.label}
                    </span>
                </button>
            ))}
        </div>
    );
};

interface MemoFiltersProps {
  tab: string;
  search: string;
  setSearch: (search: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (date: DateRange | undefined) => void;
  category: string;
  setCategory: (status: string) => void;
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

type QuickDateRange = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'lastYear';

export function MemoFilters({ 
    tab, search, setSearch, dateRange, setDateRange, 
    category, setCategory, allLabels, selectedLabels, 
    setSelectedLabels, show, setShow, toggle, isExpanded, onRefresh, loading 
}: MemoFiltersProps) {
  const { setSearchParams } = useSearchParams();
  const [activeQuickDate, setActiveQuickDate] = useState<QuickDateRange | null>(null);

  const debouncedSetSearch = useDebouncedCallback((value) => {
    setSearchParams({ q: value });
  }, 300);

  const handleDateChange = (range: DateRange | undefined) => {
      setActiveQuickDate(null);
      setDateRange(range);
      setSearchParams({ 
        from: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
        to: range?.to ? format(range.to, 'yyyy-MM-dd') : null
       });
  }

  const setQuickDate = (range: QuickDateRange) => {
    if (activeQuickDate === range) return;

    const now = new Date();
    let from: Date;
    let to: Date | undefined = undefined;

    switch(range) {
        case 'today':
            from = startOfDay(now);
            to = endOfDay(now);
            break;
        case 'yesterday':
            const yesterday = subDays(now, 1);
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
    setActiveQuickDate(range);
    setSearchParams({ 
      from: from.toISOString(),
      to: to?.toISOString() ?? from.toISOString()
     });
  };


  const handleCategoryChange = (newCategory: string) => {
      setCategory(newCategory);
      setSearchParams({ category: newCategory === 'all' ? null : newCategory });
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
    setCategory('all');
    setSelectedLabels([]);
    setShow('');
    setActiveQuickDate(null);
    setSearchParams({ q: null, from: null, to: null, category: null, labels: null, show: null });
  }

  const hasActiveFilters = search || dateRange || category !== 'all' || selectedLabels.length > 0 || (show && tab !== 'favorites');
  
  const selectedLabelObjects = selectedLabels.map(id => {
      return allLabels.find(l => l.id === id);
  }).filter(Boolean) as LabelType[];

  const quickDateButtons: { value: QuickDateRange; label: string; icon: React.ReactNode }[] = [
    { value: 'today', label: 'Today', icon: <CalendarDays className="h-4 w-4" /> },
    { value: 'yesterday', label: 'Yesterday', icon: <Rewind className="h-4 w-4" /> },
    { value: 'thisWeek', label: 'This Week', icon: <CornerDownLeft className="h-4 w-4" /> },
    { value: 'thisMonth', label: 'This Month', icon: <ChevronsRight className="h-4 w-4" /> },
    { value: 'thisYear', label: 'This Year', icon: <Book className="h-4 w-4" /> },
    { value: 'lastYear', label: 'Last Year', icon: <BookCopy className="h-4 w-4" /> },
  ];


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
            {(tab === 'inbox') && (
                <FilterTabs items={inboxFilterItems} selected={category} onSelect={handleCategoryChange} />
            )}
            {(tab === 'sent') && (
                <FilterTabs items={sentFilterItems} selected={category} onSelect={handleCategoryChange} />
            )}
           <div className="flex items-center gap-2 flex-wrap">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-full sm:w-auto flex-1 justify-start text-left font-medium transition-colors",
                        !dateRange && "text-muted-foreground",
                        dateRange && "border-primary/70 dark:border-primary/80 text-primary bg-primary/10 dark:bg-primary/25 shadow-sm"
                    )}
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
                        <span>Pick a date</span>
                    )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex bg-card text-foreground" align="start">
                    <div className="flex flex-col space-y-1 border-r border-border bg-muted/30 dark:bg-muted/10 p-2">
                        {quickDateButtons.map((item) => (
                           <Button
                                key={item.value}
                                variant={activeQuickDate === item.value ? 'secondary' : 'ghost'}
                                size="sm"
                                className="justify-start text-foreground hover:bg-muted/60 dark:hover:bg-muted/30 gap-2"
                                onClick={() => setQuickDate(item.value)}
                           >
                                {item.icon} {item.label}
                           </Button>
                        ))}
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
