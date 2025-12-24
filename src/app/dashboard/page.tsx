
'use client'

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { useRouter } from "next/navigation"
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
import { Skeleton } from "@/components/ui/skeleton"

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "inbox";
  const memoIdFromUrl = searchParams.get('id');

  const [user, setUser] = useState<User | null>(null);
  const [memos, setMemos] = useState<MemoWithActivity[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(memoIdFromUrl);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

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


  const handleSelectMemo = (id: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('id', id);
    router.push(`/dashboard?${newParams.toString()}`);
  }

  const loadMemos = useCallback(async () => {
    if (!user) return; // Don't load if no user
    setLoading(true);
    const dateRangeParams = {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
    };
    try {
      const data = await getDashboardData(tab, search, status, dateRangeParams);
      setMemos(data as MemoWithActivity[]);
      
      // Select first memo if none is selected from URL, but only if the list is not empty
      if (data.length > 0 && !data.some(m => m.id === memoIdFromUrl)) {
        if (data[0].status !== 'draft') {
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.set('id', data[0].id);
          router.push(`/dashboard?${newParams.toString()}`);
        } else {
          setSelectedMemoId(null)
        }
      } else if (data.length === 0) {
        setSelectedMemoId(null)
      }

    } catch (error) {
      console.error("Failed to load memos:", error);
      // Handle not authenticated error gracefully
      setMemos([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search, status, dateRange, user, router, memoIdFromUrl]);

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  useEffect(() => {
    if (memoIdFromUrl) {
      setSelectedMemoId(memoIdFromUrl);
      const selectedMemo = memos.find(m => m.id === memoIdFromUrl);
      if(user && selectedMemo && selectedMemo.status !== 'draft' && !selectedMemo.activity.some(a => a.action === 'viewed' && a.actorId === user.id)) {
        markAsRead(memoIdFromUrl).then(() => {
            // Optimistically update the memo in state
            setMemos(prevMemos => prevMemos.map(m => 
                m.id === memoIdFromUrl 
                ? { ...m, activity: [...m.activity, { id: 'temp-view', actorId: user.id, action: 'viewed' } as any] }
                : m
            ));
        });
      }
    }
  }, [memoIdFromUrl, memos, user]);

  const selectedMemo = memos.find(memo => memo.id === selectedMemoId) || null;

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

  if (!user && !loading) {
    // This case can happen briefly when the user is being redirected by middleware.
    // Show a loader to prevent flashes of empty content.
     return <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center"><Skeleton className="h-full w-full" /></div>;
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
            <div className="p-2 space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        ) : memos.length > 0 ? (
          <MemoList 
            memos={memos} 
            selectedMemoId={selectedMemoId} 
            onSelectMemo={handleSelectMemo}
            isExpanded={isListExpanded}
            />
        ) : (
          <div className="h-full p-2">
            <EmptyState title={emptyState.title} description={emptyState.description} action={emptyState.action} />
          </div>
        )}
      </Card>
      <div className="h-full overflow-y-auto rounded-lg no-print">
        <MemoDisplay 
            memo={selectedMemo} 
            onUpdate={loadMemos} 
        />
      </div>
      <div className="hidden print:block col-span-2">
         <MemoDisplay memo={selectedMemo} onUpdate={loadMemos} />
      </div>
    </div>
  )
}


export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center"><Skeleton className="h-full w-full" /></div>}>
            <DashboardContent />
        </Suspense>
    )
}
