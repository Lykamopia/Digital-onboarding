'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FilterX, Calendar, MapPin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { KPIMetadata } from '@/app/actions/kpi';

interface StatusFiltersProps {
  metadata: KPIMetadata | null;
}

export function StatusFilters({ metadata }: StatusFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateRange = searchParams.get('dateRange') || 'month';
  const region = searchParams.get('region') || 'ALL';
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'ALL') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('?');
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-card rounded-xl border shadow-sm">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Time Period
        </Label>
        <Select 
          value={dateRange} 
          onValueChange={(val) => updateFilters({ dateRange: val, fromDate: null, toDate: null })}
        >
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dateRange === 'custom' && (
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-[130px] h-9 justify-start text-left font-normal", !fromDate && "text-muted-foreground")}
                >
                  {fromDate ? format(new Date(fromDate), "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={fromDate ? new Date(fromDate) : undefined}
                  onSelect={(date) => updateFilters({ fromDate: date?.toISOString() || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-[130px] h-9 justify-start text-left font-normal", !toDate && "text-muted-foreground")}
                >
                  {toDate ? format(new Date(toDate), "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={toDate ? new Date(toDate) : undefined}
                  onSelect={(date) => updateFilters({ toDate: date?.toISOString() || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Regional Filter
        </Label>
        <Select 
          value={region} 
          onValueChange={(val) => updateFilters({ region: val })}
        >
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Regions</SelectItem>
            {metadata?.regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {(dateRange !== 'month' || region !== 'ALL') && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-9 px-3 text-muted-foreground hover:text-foreground"
          >
            <FilterX className="h-4 w-4 mr-2" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
