
'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from 'next/navigation'
import { useRouter, usePathname } from "next/navigation"
import type { DashboardMemo, MemoWithActivity, User, Label as LabelType, DateRange, LoggedInUser } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { MemoFilters } from "@/components/memo-filters"
import { PanelLeft, PanelRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDashboardData, getLabels, markAsRead, getMemo } from "../actions/memo"
import { HoneycombLoader } from "@/components/honeycomb-loader"
import { InboxEmptyIllustration } from "@/components/inbox-empty-illustration"
import { SentEmptyIllustration } from "@/components/sent-empty-illustration"
import { DraftEmptyIllustration } from "@/components/draft-empty-illustration"
import { ArchiveEmptyIllustration } from "@/components/archive-empty-illustration"
import { SearchEmptyIllustration } from "@/components/search-empty-illustration"
import { MemoEmptyIllustration } from "@/components/memo-empty-illustration"
import { useIsMobile } from "@/hooks/use-mobile"
import { FavoritesEmptyIllustration } from "@/components/favorites-empty-illustration"
import { useSettings } from "@/components/settings-provider"
import { toast } from "sonner"

// Global session cache for memo details to prevent redundant API calls across tab navigations
const memoDetailCache = new Map<string, MemoWithActivity>();

const determineCorrectFolder = (memo: MemoWithActivity, user: LoggedInUser | null): string | null => {
    if (!user) return null;

    const isArchived = memo.archivedBy?.some(u => u.id === user.id);
    if (isArchived) return 'archive';

    if (memo.fromId === user.id) {
        if (memo.status === 'draft') return 'drafts';
        if (memo.status === 'scheduled') return 'scheduled';
        return 'sent';
    }

    const isRecipient = memo.to.some(u => u.id === user.id) ||
                        memo.cc.some(u => u.id === user.id) ||
                        memo.current_holder?.id === user.id;

    if (isRecipient) return 'inbox';

    return null;
}

function DashboardContent({ tab, initialMemos, user }: { tab: string; initialMemos: DashboardMemo[]; user: LoggedInUser | null; }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memoIdFromUrl = searchParams.get('id');
  const isMobile = useIsMobile();
  const { settings } = useSettings();

  const [memos, setMemos] = useState<DashboardMemo[]>(initialMemos);
  const [selectedMemo, setSelectedMemo] = useState<MemoWithActivity | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [allLabels, setAllLabels] = useState<LabelType[]>([]);
  const loadingRef = useRef(false);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from) {
      return { from: new Date(from), to: to ? new Date(to) : undefined };
    }
    return undefined;
  });
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() => {
      const labels = searchParams.get('labels');
      return labels ? labels.split(',') : [];
  });
  const [show, setShow] = useState(searchParams.get('show') || '');
  
  useEffect(() => {
    if (allLabels.length === 0) {
      getLabels().then(setAllLabels);
    }
  }, [allLabels.length]);

  useEffect(() => {
    const handleNewMemo = (event: Event) => {
        const customEvent = event as CustomEvent;
        const newMemo: MemoWithActivity = customEvent.detail.memo;

        if (tab === 'inbox') {
            setMemos(prevMemos => {
                if (prevMemos.some(m => m.id === newMemo.id)) return prevMemos;
                return [newMemo, ...prevMemos] as DashboardMemo[];
            });
        }
    };
    
    window.addEventListener('new-memo-received', handleNewMemo);

    return () => {
      window.removeEventListener('new-memo-received', handleNewMemo);
    };
  }, [tab]);


  const markMemoAsReadInState = useCallback((memoId: string) => {
    if (!user) return;
    const actorId = user.actingUser ? user.actingUser.id : user.id;

    setMemos(prevMemos => prevMemos.map(m => {
        if (m.id !== memoId) return m;

        const hasViewed = m.activity.some(a => a.action === 'viewed' && a.actorId === actorId);
        if (hasViewed) return m;

        const updatedMemo = { ...m };
        updatedMemo.activity = [...m.activity, { action: 'viewed', actorId }];
        
        if (settings.acknowledgementMode === 'auto') {
            updatedMemo.acknowledgedBy = [...(updatedMemo.acknowledgedBy || []), { id: user.id }];
            updatedMemo.status = m.status === 'open' ? 'in_progress' : m.status;
        }
        return updatedMemo;
    }));
  }, [user, settings.acknowledgementMode]);

  useEffect(() => {
    const handleMarkAllAsRead = () => {
        if (!user) return;
        const actorId = user.actingUser ? user.actingUser.id : user.id;
        setMemos(prevMemos => prevMemos.map(m => {
            if (!m.activity.some(a => a.action === 'viewed' && a.actorId === actorId)) {
                return { 
                    ...m, 
                    activity: [...m.activity, { action: 'viewed', actorId }],
                    status: (settings.acknowledgementMode === 'auto' && m.status === 'open') ? 'in_progress' : m.status
                };
            }
            return m;
        }));
    };
    window.addEventListener('mark-all-memos-as-read', handleMarkAllAsRead);
    return () => {
        window.removeEventListener('mark-all-memos-as-read', handleMarkAllAsRead);
    };
  }, [user, settings.acknowledgementMode]);

  // Handle optimistic acknowledgement updates from MemoDisplay
  useEffect(() => {
    const handleOptimisticAck = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { memoId, status, acknowledgedBy } = customEvent.detail;
        
        setMemos(prevMemos => prevMemos.map(m => {
            if (m.id !== memoId) return m;
            return { 
                ...m, 
                status, 
                acknowledgedBy,
                activity: [{ action: 'acknowledged' as const, actorId: user?.actingUser?.id || user?.id || '' }, ...m.activity]
            };
        }));
    };
    window.addEventListener('memo-acknowledged-locally', handleOptimisticAck);
    return () => {
        window.removeEventListener('memo-acknowledged-locally', handleOptimisticAck);
    };
  }, [user]);

  // Keep the session cache synchronized with updates from the detail view
  useEffect(() => {
    if (selectedMemo && selectedMemo.id && selectedMemo.id !== 'preview') {
      memoDetailCache.set(selectedMemo.id, selectedMemo);
    }
  }, [selectedMemo]);

  const handleSelectMemo = useCallback((id: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('id', id);
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const handleDeselectMemo = useCallback(() => {
    setSelectedMemo(null);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('id');
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);


  const loadMemos = useCallback(async (forceReload = false, clearCache = false) => {
    if (!user && !forceReload) return;
    if (loadingRef.current && !forceReload) return;
    
    // Invalidate session cache only on manual refresh
    if (clearCache) {
        memoDetailCache.clear();
    }

    loadingRef.current = true;
    setLoading(true);
    const dateRangeParams = {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
    };
    try {
      const currentShow = tab === 'favorites' ? '' : show;
      const data = await getDashboardData(tab, search, category, dateRangeParams, selectedLabels, currentShow, statusFilter);
      setMemos(data as DashboardMemo[]);
    } catch (error) {
      console.error("Failed to load memos:", error);
      setMemos([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [tab, search, category, dateRange, user, selectedLabels, show, statusFilter]);

  useEffect(() => {
    loadMemos();
  }, [search, category, dateRange, selectedLabels, show, statusFilter, loadMemos]);

   useEffect(() => {
    if (memoIdFromUrl) {
      // 1. Identity Check: Avoid redundant API calls if the memo is already active
      if (selectedMemo?.id === memoIdFromUrl) return;

      setLoadingMemo(true);
      
      // 2. Cache Retrieval: Check the session cache for details loaded in other folders/tabs
      const cached = memoDetailCache.get(memoIdFromUrl);
      if (cached) {
        const correctFolder = determineCorrectFolder(cached, user);
        if (correctFolder && tab !== correctFolder) {
            router.replace(`/dashboard/${correctFolder}?id=${memoIdFromUrl}`);
            return;
        }

        setSelectedMemo(cached);
        setLoadingMemo(false);

        // Process read status for cached hits
        const actorIdToCheck = user?.actingUser ? user.actingUser.id : user?.id;
        if (user && tab === 'inbox' && !cached.activity.some(a => a.action === 'viewed' && a.actorId === actorIdToCheck)) {
            markAsRead(cached.id);
            markMemoAsReadInState(cached.id);
        }
        return;
      }

      setSelectedMemo(null);
      
      getMemo(memoIdFromUrl).then(fullMemo => {
        if (fullMemo) {
            const correctFolder = determineCorrectFolder(fullMemo as MemoWithActivity, user);
            if (correctFolder && tab !== correctFolder) {
                router.replace(`/dashboard/${correctFolder}?id=${memoIdFromUrl}`);
                return;
            }

            const fullMemoWithActivity = fullMemo as MemoWithActivity;
            // 3. Cache Population: Store results in the cross-folder session cache
            memoDetailCache.set(fullMemoWithActivity.id, fullMemoWithActivity);
            setSelectedMemo(fullMemoWithActivity);

            const actorIdToCheck = user?.actingUser ? user.actingUser.id : user?.id;
            if (user && tab === 'inbox' && !fullMemoWithActivity.activity.some(a => a.action === 'viewed' && a.actorId === actorIdToCheck)) {
                markAsRead(fullMemoWithActivity.id);
                markMemoAsReadInState(fullMemoWithActivity.id);
            }
        } else {
            toast.error("Memo not found", {
                id: `memo-not-found-${memoIdFromUrl}`,
                description: "It may have been deleted or you may not have access."
            });
            handleDeselectMemo();
        }
      }).catch(err => {
        toast.error("Failed to load memo", { id: `memo-load-error-${memoIdFromUrl}` });
        console.error(err);
        handleDeselectMemo();
      }).finally(() => {
        setLoadingMemo(false);
      });

    } else {
        setSelectedMemo(null);
    }
  }, [memoIdFromUrl, user, tab, markMemoAsReadInState, router, handleDeselectMemo, selectedMemo?.id]);
  
  
  const getEmptyState = () => {
      if (search || category !== 'all' || dateRange || selectedLabels.length > 0 || (show && tab !== 'favorites') || statusFilter !== 'all') {
        return { 
            icon: <SearchEmptyIllustration />,
            title: "No Memos Found", 
            description: "Try adjusting your search or filters."
        }
      }
      switch(tab) {
          case 'inbox':
              return { 
                icon: <InboxEmptyIllustration />,
                title: "Inbox Zero", 
                description: "You've read all your memos. Great job!" 
              };
          case 'drafts':
              return { 
                icon: <DraftEmptyIllustration />,
                title: "No Drafts", 
                description: "You haven't started any memos yet.", 
                action: <Button onClick={() => router.push('/dashboard/new')}>New Memo</Button> 
              };
          case 'sent':
              return { 
                icon: <SentEmptyIllustration />,
                title: "No Sent Memos", 
                description: "You haven't sent any memos yet." 
              };
          case 'archive':
              return { 
                icon: <ArchiveEmptyIllustration />,
                title: "Nothing in Archive", 
                description: "You haven't archived any memos." 
              };
          case 'favorites':
              return {
                icon: <FavoritesEmptyIllustration />,
                title: "No Favorites",
                description: "Mark memos as favorite to see them here."
              }
          default:
              return { 
                icon: <MemoEmptyIllustration />,
                title: "No Memos", 
                description: "There are no memos to display here." 
              };
      }
  }
  const emptyState = getEmptyState();

  const memoListToggle = (
    <Button variant="ghost" size="icon" onClick={() => setIsListExpanded(!isListExpanded)} className="hidden md:flex">
        {isListExpanded ? <PanelLeft /> : <PanelRight />}
    </Button>
  );

  if (!user && loading) {
     return <div className="h-full w-full flex items-center justify-center"><HoneycombLoader /></div>;
  }

  const showMemoList = !isMobile || (isMobile && !selectedMemo);
  const showMemoDisplay = !isMobile || (isMobile && selectedMemo);


  return (
    <div 
      id="dashboard-grid"
      className={cn(
        "grid gap-4 h-full transition-all",
        isListExpanded ? "md:grid-cols-[minmax(300px,_1fr)_2fr]" : "md:grid-cols-[80px_1fr]"
      )}
    >
      {showMemoList && (
        <Card className="no-print sticky top-0 self-start h-full min-h-0 flex flex-col transition-all duration-300 overflow-hidden bg-card">
          <MemoFilters
              tab={tab}
              search={search}
              setSearch={setSearch}
              dateRange={dateRange}
              setDateRange={setDateRange}
              category={category}
              setCategory={setCategory}
              allLabels={allLabels}
              selectedLabels={selectedLabels}
              setSelectedLabels={setSelectedLabels}
              show={show}
              setShow={setShow}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              toggle={memoListToggle}
              isExpanded={isListExpanded}
              onRefresh={() => loadMemos(true, true)}
              loading={loading}
          />
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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
                onUpdate={() => loadMemos(true)}
                user={user}
                />
            ) : (
              <div className="h-full p-2">
                <EmptyState icon={emptyState.icon} title={emptyState.title} description={emptyState.description} action={emptyState.action} />
              </div>
            )}
          </div>
        </Card>
      )}
      {showMemoDisplay && (
        <div className={cn("h-full rounded-lg no-print min-h-0 transition-colors", !selectedMemo && "bg-gradient-to-br from-primary/5 to-accent/5")}>
          {loadingMemo ? (
              <div className="h-full w-full flex items-center justify-center bg-card rounded-lg"><HoneycombLoader /></div>
          ) : (
              <MemoDisplay 
                  memo={selectedMemo}
                  setMemo={setSelectedMemo}
                  memoCount={memos.length}
                  onUpdate={() => loadMemos(true)}
                  onBack={isMobile ? handleDeselectMemo : undefined}
              />
          )}
        </div>
      )}

      <div className="hidden print:block col-span-2">
         <MemoDisplay memo={selectedMemo} memoCount={memos.length} onUpdate={() => loadMemos(true)} />
      </div>
    </div>
  )
}

export default function MainDashboard({ tab, initialMemos, user }: { tab: string, initialMemos: DashboardMemo[], user: LoggedInUser | null }) {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><HoneycombLoader /></div>}>
            <DashboardContent tab={tab} initialMemos={initialMemos} user={user} />
        </Suspense>
    )
}
