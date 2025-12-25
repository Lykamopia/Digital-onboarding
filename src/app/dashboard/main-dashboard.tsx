

'use client'

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { useRouter, usePathname } from "next/navigation"
import type { MemoWithActivity, User } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { MemoFilters } from "@/components/memo-filters"
import { DateRange } from "react-day-picker"
import { PanelLeft, PanelRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDashboardData, getLoggedInUser, markAsRead } from "../actions/memo"
import { HoneycombLoader } from "@/components/honeycomb-loader"
import { MemoEmptyIllustration } from "@/components/memo-empty-illustration"

function DashboardContent({ tab }: { tab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memoIdFromUrl = searchParams.get('id');

  const [user, setUser] = useState<User | null>(null);
  const [memos, setMemos] = useState<MemoWithActivity[]>([]);
  const [selectedMemo, setSelectedMemo] = useState<MemoWithActivity | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMemo, setLoadingMemo] = useState(false);

  // Filter states
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from) { // Only require 'from' to set a range
      return { from: new Date(from), to: to ? new Date(to) : undefined };
    }
    return undefined;
  });
  const [status, setStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    getLoggedInUser().then(setUser);
  }, []);

  // Real-time inbox update listener
  useEffect(() => {
    const handleNewMemo = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { memo: newMemo } = customEvent.detail;

        if (tab === 'inbox') {
            setMemos(prevMemos => {
                // Avoid adding duplicates
                if (prevMemos.some(m => m.id === newMemo.id)) {
                    return prevMemos;
                }
                return [newMemo, ...prevMemos];
            });
        }
    };

    window.addEventListener('new-memo-event', handleNewMemo);

    return () => {
        window.removeEventListener('new-memo-event', handleNewMemo);
    };
  }, [tab]);


  const handleSelectMemo = useCallback((id: string) => {
    const memo = memos.find(m => m.id === id);
    if (!memo || !user) return;

    // Optimistic UI update for 'read' status
    if (tab === 'inbox' && !memo.activity.some(a => a.action === 'viewed' && a.actorId === user.id)) {
      // Fire-and-forget the server action, but update the local state optimistically
      markAsRead(id);
      
      const newActivity = {
        id: `temp-view-${Date.now()}`,
        actorId: user.id,
        action: 'viewed' as const,
        actor: user,
        details: '',
        timestamp: new Date().toISOString()
      };
      
      const updatedMemo = { ...memo, activity: [...memo.activity, newActivity] };
      
      const updatedMemos = memos.map(m => m.id === id ? updatedMemo : m);
      
      setMemos(updatedMemos);
      setSelectedMemo(updatedMemo);
    } else {
      setSelectedMemo(memo);
    }

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('id', id);
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  }, [memos, user, router, pathname, searchParams, tab]);

  const loadMemos = useCallback(async (forceReload = false) => {
    if (!user && !forceReload) return;
    setLoading(true);
    const dateRangeParams = {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
    };
    try {
      const data = await getDashboardData(tab, search, status, dateRangeParams);
      setMemos(data as MemoWithActivity[]);

      if (memoIdFromUrl) {
          const memoToSelect = data.find(m => m.id === memoIdFromUrl);
           if (memoToSelect) {
              setSelectedMemo(memoToSelect);
              if (user && memoToSelect.status !== 'draft' && !memoToSelect.activity.some(a => a.action === 'viewed' && a.actorId === user.id)) {
                  markAsRead(memoToSelect.id);
              }
          } else {
              setSelectedMemo(null);
              // Clear the ID from URL if memo not found in the current list
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.delete('id');
              router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
          }
      } else {
          // If no memoId in URL, ensure nothing is selected
          setSelectedMemo(null);
      }

    } catch (error) {
      console.error("Failed to load memos:", error);
      setMemos([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search, status, dateRange, user, memoIdFromUrl, pathname, router, searchParams]);

  useEffect(() => {
    if (user) {
      loadMemos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, search, status, dateRange]); // This effect ONLY runs when filters change

  useEffect(() => {
      // This effect syncs the selected memo with the URL id, but does NOT reload the list.
      if (memoIdFromUrl) {
          const memo = memos.find(m => m.id === memoIdFromUrl);
          if (memo && memo.id !== selectedMemo?.id) {
              setSelectedMemo(memo);
          }
      } else if (selectedMemo) {
          // if there is a selected memo but no id in url, deselect it.
          setSelectedMemo(null);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoIdFromUrl, memos]);
  
  const getEmptyState = () => {
      if (search || status || dateRange) {
        return { title: "No Memos Found", description: "Try adjusting your search or filters."}
      }
      switch(tab) {
          case 'inbox':
              return { title: "Inbox Zero", description: "You've read all your memos. Great job!" };
          case 'drafts':
              return { title: "No Drafts", description: "You haven't started any memos yet.", action: <Button onClick={() => router.push('/dashboard/new')}>New Memo</Button> };
          case 'sent':
              return { title: "No Sent Memos", description: "You haven't sent any memos yet." };
          case 'archive':
              return { title: "Nothing in Archive", description: "You haven't archived any memos." };
          default:
              return { title: "No Memos", description: "There are no memos to display here." };
      }
  }
  const emptyState = getEmptyState();

  const memoListToggle = (
    <Button variant="ghost" size="icon" onClick={() => setIsListExpanded(!isListExpanded)} className="hidden md:flex">
        {isListExpanded ? <PanelLeft /> : <PanelRight />}
    </Button>
  );

  if (!user && loading) {
     return <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center"><HoneycombLoader /></div>;
  }

  return (
    <div 
        className={cn(
            "grid gap-4 h-[calc(100vh-8rem)] transition-all",
            isListExpanded ? "md:grid-cols-[minmax(300px,_1fr)_2fr]" : "md:grid-cols-[80px_1fr]"
        )}
    >
      <Card className="no-print flex flex-col transition-all duration-300">
        <MemoFilters
            tab={tab}
            search={search}
            setSearch={setSearch}
            dateRange={dateRange}
            setDateRange={setDateRange}
            status={status}
            setStatus={setStatus}
            isExpanded={isListExpanded}
            toggle={memoListToggle}
        />
        {loading ? (
            <div className="h-full w-full flex items-center justify-center"><HoneycombLoader /></div>
        ) : memos.length > 0 ? (
          <MemoList 
            memos={memos}
            setMemos={setMemos}
            selectedMemoId={selectedMemo?.id || null} 
            onSelectMemo={handleSelectMemo}
            isExpanded={isListExpanded}
            tab={tab}
            />
        ) : (
          <div className="h-full p-2">
            <EmptyState title={emptyState.title} description={emptyState.description} action={emptyState.action} />
          </div>
        )}
      </Card>
      <div className="h-full overflow-y-auto rounded-lg no-print">
        {loadingMemo ? (
             <div className="h-full w-full flex items-center justify-center bg-card rounded-lg"><HoneycombLoader /></div>
        ) : (
            <MemoDisplay 
                memo={selectedMemo} 
                onUpdate={() => loadMemos(true)}
            />
        )}
      </div>
      <div className="hidden print:block col-span-2">
         <MemoDisplay memo={selectedMemo} onUpdate={() => loadMemos(true)} />
      </div>
    </div>
  )
}

export default function MainDashboard({ tab }: { tab: string }) {
    return (
        <Suspense fallback={<div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center"><HoneycombLoader /></div>}>
            <DashboardContent tab={tab} />
        </Suspense>
    )
}
