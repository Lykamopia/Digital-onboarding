
'use client'

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { useRouter, usePathname } from "next/navigation"
import type { MemoWithActivity, User, Label as LabelType } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { MemoFilters } from "@/components/memo-filters"
import { DateRange } from "react-day-picker"
import { PanelLeft, PanelRight, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDashboardData, getLabels, markAsRead } from "../actions/memo"
import { HoneycombLoader } from "@/components/honeycomb-loader"
import { useNotification } from "@/components/notification-provider"
import { InboxEmptyIllustration } from "@/components/inbox-empty-illustration"
import { SentEmptyIllustration } from "@/components/sent-empty-illustration"
import { DraftEmptyIllustration } from "@/components/draft-empty-illustration"
import { ArchiveEmptyIllustration } from "@/components/archive-empty-illustration"
import { SearchEmptyIllustration } from "@/components/search-empty-illustration"
import { MemoEmptyIllustration } from "@/components/memo-empty-illustration"

function DashboardContent({ tab, initialMemos, user }: { tab: string; initialMemos: MemoWithActivity[]; user: User | null; }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memoIdFromUrl = searchParams.get('id');

  const { showNotification } = useNotification();
  const [memos, setMemos] = useState<MemoWithActivity[]>(initialMemos);
  const [selectedMemo, setSelectedMemo] = useState<MemoWithActivity | null>(null);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [allLabels, setAllLabels] = useState<LabelType[]>([]);


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
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() => {
      const labels = searchParams.get('labels');
      return labels ? labels.split(',') : [];
  });
  const [show, setShow] = useState(searchParams.get('show') || '');
  
  useEffect(() => {
    getLabels().then(setAllLabels);
  }, []);

  // WebSocket connection for real-time memo updates
  useEffect(() => {
    if (!user) return;
    
    // In a real application, the WebSocket URL would come from environment variables.
    const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WebSocket connection established');
    };

    socket.onmessage = (event) => {
        try {
            const eventData = JSON.parse(event.data);
            
            // Assuming server sends messages with a 'type' and 'payload'
            if (eventData.type === 'new-memo' && eventData.payload) {
                const newMemo: MemoWithActivity = eventData.payload;

                // Check if the memo is relevant to the current user
                const isRecipient = newMemo.to.some(u => u.id === user.id) || newMemo.cc.some(u => u.id === user.id);
                
                if (tab === 'inbox' && isRecipient) {
                     setMemos(prevMemos => {
                        // Prevent duplicate entries
                        if (prevMemos.some(m => m.id === newMemo.id)) {
                            return prevMemos;
                        }
                        return [newMemo, ...prevMemos];
                    });
                }
                
                if (isRecipient) {
                    // Trigger a toast notification
                    showNotification({
                        title: 'New Memo Received',
                        description: `From: ${newMemo.from.name} - ${newMemo.subject}`,
                        memoId: newMemo.id,
                    });
                }
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Clean up the connection when the component unmounts
    return () => {
      socket.close();
    };
  }, [tab, user, showNotification]);


  const markMemoAsReadInState = useCallback((memoId: string) => {
    if (!user) return;
    setMemos(prevMemos => prevMemos.map(m => {
        if (m.id === memoId && !m.activity.some(a => a.action === 'viewed' && a.actorId === user.id)) {
            const newActivity = {
                id: `temp-view-${Date.now()}`,
                actorId: user.id,
                action: 'viewed' as const,
                actor: user,
                details: '',
                timestamp: new Date().toISOString()
            };
            const updatedMemo = { ...m, activity: [...m.activity, newActivity] };
            if (selectedMemo?.id === memoId) {
                setSelectedMemo(updatedMemo);
            }
            return updatedMemo;
        }
        return m;
    }));
  }, [user, selectedMemo?.id]);


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
        setMemos(prevMemos => prevMemos.map(m => {
            if (!m.activity.some(a => a.action === 'viewed' && a.actorId === user.id)) {
                 const newActivity = {
                    id: `temp-view-${Date.now()}`,
                    actorId: user.id,
                    action: 'viewed' as const,
                    actor: user,
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

    // Optimistic UI update for 'read' status
    if (tab === 'inbox' && !memo.activity.some(a => a.action === 'viewed' && a.actorId === user.id)) {
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

  const loadMemos = useCallback(async (forceReload = false) => {
    if (!user && !forceReload) return;
    setLoading(true);
    const dateRangeParams = {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
    };
    try {
      const data = await getDashboardData(tab, search, status, dateRangeParams, selectedLabels, show);
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
  }, [tab, search, status, dateRange, user, memoIdFromUrl, pathname, router, searchParams, selectedLabels, show]);

  useEffect(() => {
    loadMemos();
  }, [search, status, dateRange, selectedLabels, show]); // This effect ONLY runs when filters change

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
      if (search || status || dateRange || selectedLabels.length > 0 || show) {
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
                icon: <Star className="h-20 w-20 text-yellow-400/30" />,
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

  return (
    <div 
      className={cn(
        "grid gap-4 h-full transition-all",
        isListExpanded ? "md:grid-cols-[minmax(300px,_1fr)_2fr]" : "md:grid-cols-[80px_1fr]"
      )}
    >
      <Card className="no-print sticky top-0 self-start h-full min-h-0 flex flex-col transition-all duration-300 overflow-hidden">
        <MemoFilters
            tab={tab}
            search={search}
            setSearch={setSearch}
            dateRange={dateRange}
            setDateRange={setDateRange}
            status={status}
            setStatus={setStatus}
            allLabels={allLabels}
            selectedLabels={selectedLabels}
            setSelectedLabels={setSelectedLabels}
            show={show}
            setShow={setShow}
            isExpanded={isListExpanded}
            toggle={memoListToggle}
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
      <div className="h-full rounded-lg no-print min-h-0">
        {loadingMemo ? (
             <div className="h-full w-full flex items-center justify-center bg-card rounded-lg"><HoneycombLoader /></div>
        ) : (
            <MemoDisplay 
                memo={selectedMemo} 
                memoCount={memos.length}
                onUpdate={() => loadMemos(true)}
            />
        )}
      </div>
      <div className="hidden print:block col-span-2">
         <MemoDisplay memo={selectedMemo} memoCount={memos.length} onUpdate={() => loadMemos(true)} />
      </div>
    </div>
  )
}

export default function MainDashboard({ tab, initialMemos, user }: { tab: string, initialMemos: MemoWithActivity[], user: User | null }) {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><HoneycombLoader /></div>}>
            <DashboardContent tab={tab} initialMemos={initialMemos} user={user} />
        </Suspense>
    )
}
