

'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from 'next/navigation'
import { useRouter, usePathname } from "next/navigation"
import type { MemoWithActivity, User, Label as LabelType, DateRange, LoggedInUser } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { MemoFilters } from "@/components/memo-filters"
import { PanelLeft, PanelRight, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDashboardData, getLabels, markAsRead } from "../actions/memo"
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

function DashboardContent({ tab, initialMemos, user }: { tab: string; initialMemos: MemoWithActivity[]; user: LoggedInUser | null; }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memoIdFromUrl = searchParams.get('id');
  const isMobile = useIsMobile();
  const { settings } = useSettings();

  const [memos, setMemos] = useState<MemoWithActivity[]>(initialMemos);
  const [selectedMemo, setSelectedMemo] = useState<MemoWithActivity | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [allLabels, setAllLabels] = useState<LabelType[]>([]);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const loadingRef = useRef(false);

  // Filter states
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from) { // Only require 'from' to set a range
      return { from: new Date(from), to: to ? new Date(to) : undefined };
    }
    return undefined;
  });
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() => {
      const labels = searchParams.get('labels');
      return labels ? labels.split(',') : [];
  });
  const [show, setShow] = useState(searchParams.get('show') || '');
  
  // Cache labels - only fetch once
  useEffect(() => {
    if (allLabels.length === 0) {
      getLabels().then(setAllLabels);
    }
  }, [allLabels.length]);

  // Client-side real-time memo updates
  useEffect(() => {
    const handleNewMemo = (event: Event) => {
        const customEvent = event as CustomEvent;
        const newMemo: MemoWithActivity = customEvent.detail.memo;

        // If we're on the inbox page, add it to the top of the list
        if (tab === 'inbox') {
            setMemos(prevMemos => {
                // Prevent duplicates
                if (prevMemos.some(m => m.id === newMemo.id)) {
                    return prevMemos;
                }
                return [newMemo, ...prevMemos];
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

    const updateUser = (m: MemoWithActivity | null) => {
        if (!m || m.id !== memoId) return m;

        let updatedMemo = { ...m };
        let hasChanged = false;

        const hasViewed = updatedMemo.activity.some(a => a.action === 'viewed' && a.actorId === actorId);
        if (!hasViewed) {
            const newViewActivity = {
                id: `temp-view-${Date.now()}`,
                actorId: actorId,
                action: 'viewed' as const,
                actor: user.actingUser || user,
                details: '',
                timestamp: new Date().toISOString()
            };
            updatedMemo = { ...updatedMemo, activity: [...updatedMemo.activity, newViewActivity] };
            hasChanged = true;
        }
        
        const hasAcknowledged = updatedMemo.acknowledgedBy?.some(u => u.id === user.id);
        if (settings.acknowledgementMode === 'auto' && !hasAcknowledged) {
            const newAckActivity = {
                id: `temp-ack-${Date.now()}`,
                actorId: actorId,
                action: 'acknowledged' as const,
                actor: user.actingUser || user,
                details: 'Automatically acknowledged upon read.',
                timestamp: new Date().toISOString()
            };
            updatedMemo = { 
                ...updatedMemo, 
                acknowledgedBy: [...(updatedMemo.acknowledgedBy || []), user],
                activity: [...updatedMemo.activity, newAckActivity] 
            };
            hasChanged = true;
        }

        return hasChanged ? updatedMemo : m;
    };

    setMemos(prevMemos => prevMemos.map(updateUser) as MemoWithActivity[]);
    setSelectedMemo(prevMemo => updateUser(prevMemo));
  }, [user, settings.acknowledgementMode]);


  // Listener for client-side events like "mark all as read"
  useEffect(() => {
    const handleMarkAsRead = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { memoId } = customEvent.detail;
        if(memoId) {
            markMemoAsReadInState(memoId);
        }
    };
    
    const handleMarkAllAsRead = () => {
        if (!user) return;
        const actorId = user.actingUser ? user.actingUser.id : user.id;
        setMemos(prevMemos => prevMemos.map(m => {
            if (!m.activity.some(a => a.action === 'viewed' && a.actorId === actorId)) {
                 const newActivity = {
                    id: `temp-view-${Date.now()}`,
                    actorId: actorId,
                    action: 'viewed' as const,
                    actor: user.actingUser || user,
                    details: '',
                    timestamp: new Date().toISOString()
                };
                return { ...m, activity: [...m.activity, newActivity] };
            }
            return m;
        }));
    };

    window.addEventListener('mark-memo-as-read', handleMarkAsRead);
    window.addEventListener('mark-all-memos-as-read', handleMarkAllAsRead);

    return () => {
        window.removeEventListener('mark-memo-as-read', handleMarkAsRead);
        window.removeEventListener('mark-all-memos-as-read', handleMarkAllAsRead);
    };
  }, [markMemoAsReadInState, user]);


  const handleSelectMemo = useCallback((id: string) => {
    const memo = memos.find(m => m.id === id);
    if (!memo || !user) return;
    const actorId = user.actingUser ? user.actingUser.id : user.id;

    // Optimistic UI update for 'read' status
    if (tab === 'inbox' && !memo.activity.some(a => a.action === 'viewed' && a.actorId === actorId)) {
      // Fire-and-forget the server action, but update the local state optimistically
      markAsRead(id);
      markMemoAsReadInState(id);
    } else {
      setSelectedMemo(memo);
    }

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('id', id);
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  }, [memos, user, router, pathname, searchParams, tab, markMemoAsReadInState]);

  const handleDeselectMemo = useCallback(() => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('id');
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);


  const loadMemos = useCallback(async (forceReload = false) => {
    if (!user && !forceReload) return;
    
    // Prevent duplicate concurrent requests
    if (loadingRef.current && !forceReload) {
      return;
    }
    
    // Skip initial load if we already have initialMemos and no filters are applied
    if (!hasInitialLoad && !forceReload && initialMemos.length > 0 && 
        !search && category === 'all' && !dateRange && selectedLabels.length === 0 && !show) {
      setHasInitialLoad(true);
      // Set selected memo from URL if present
      if (memoIdFromUrl) {
        const memoToSelect = initialMemos.find(m => m.id === memoIdFromUrl);
        if (memoToSelect) {
          setSelectedMemo(memoToSelect);
          const actorId = user?.actingUser ? user.actingUser.id : user!.id;
          if (user && memoToSelect.status !== 'draft' && !memoToSelect.activity.some(a => a.action === 'viewed' && a.actorId === actorId)) {
            markAsRead(memoToSelect.id);
          }
        }
      }
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);
    const dateRangeParams = {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
    };
    try {
      const currentShow = tab === 'favorites' ? '' : show;
      const data = await getDashboardData(tab, search, category, dateRangeParams, selectedLabels, currentShow);
      setMemos(data as MemoWithActivity[]);
      setHasInitialLoad(true);

      // Memo selection is handled by the separate useEffect that watches memoIdFromUrl
      // This prevents unnecessary reloads when just selecting a different memo

    } catch (error) {
      console.error("Failed to load memos:", error);
      setMemos([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [tab, search, category, dateRange, user, selectedLabels, show, hasInitialLoad, initialMemos, memoIdFromUrl]);

  // Only load memos when filters change, not on initial mount if we have initialMemos
  useEffect(() => {
    // Skip if we haven't done initial load yet and have initial data
    if (!hasInitialLoad && initialMemos.length > 0 && 
        !search && category === 'all' && !dateRange && selectedLabels.length === 0 && !show) {
      return;
    }
    loadMemos();
  }, [search, category, dateRange, selectedLabels, show, loadMemos, hasInitialLoad, initialMemos]);

  useEffect(() => {
      // This effect syncs the selected memo with the URL id, but does NOT reload the list.
      if (memoIdFromUrl) {
          const memo = memos.find(m => m.id === memoIdFromUrl);
          if (memo && memo.id !== selectedMemo?.id) {
              setSelectedMemo(memo);
              const actorId = user?.actingUser ? user.actingUser.id : user!.id;
              // Mark as read if needed (only once)
              if (user && tab === 'inbox' && memo.status !== 'draft' && 
                  !memo.activity.some(a => a.action === 'viewed' && a.actorId === actorId)) {
                  markAsRead(memo.id);
                  markMemoAsReadInState(memo.id);
              }
          } else if (!memo && memos.length > 0 && hasInitialLoad) {
              // Memo not in current list after initial load - clear from URL
              // This happens when memo doesn't match current filters
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.delete('id');
              router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
          }
      } else if (selectedMemo) {
          // if there is a selected memo but no id in url, deselect it.
          setSelectedMemo(null);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoIdFromUrl, memos, hasInitialLoad]);
  
  const getEmptyState = () => {
      if (search || category !== 'all' || dateRange || selectedLabels.length > 0 || (show && tab !== 'favorites')) {
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
              toggle={memoListToggle}
              isExpanded={isListExpanded}
              onRefresh={() => loadMemos(true)}
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

export default function MainDashboard({ tab, initialMemos, user }: { tab: string, initialMemos: MemoWithActivity[], user: LoggedInUser | null }) {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><HoneycombLoader /></div>}>
            <DashboardContent tab={tab} initialMemos={initialMemos} user={user} />
        </Suspense>
    )
}
