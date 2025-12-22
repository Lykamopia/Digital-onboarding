'use client'

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { memos as initialMemos, loggedInUser } from "@/lib/data"
import type { MemoWithActivity, Memo } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter();
  const tab = searchParams.get("tab") || "inbox"

  const [memos, setMemos] = useState<MemoWithActivity[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);

  const loadMemos = useCallback(() => {
    let allDrafts: Memo[] = [];
    let sentMemos: MemoWithActivity[] = [];
    
    if (typeof window !== 'undefined') {
        // scan localStorage for all drafts
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('memo-draft-')) {
                const draftContent = localStorage.getItem(key);
                if (draftContent) {
                    allDrafts.push(JSON.parse(draftContent));
                }
            }
        }
        
        const sentMemosFromStorage = localStorage.getItem('memos');
        sentMemos = sentMemosFromStorage ? JSON.parse(sentMemosFromStorage) : [];
    }
    
    const draftsWithActivity = allDrafts.map(d => ({ ...d, activity: []}));
    const sentMemoIds = new Set(sentMemos.map(m => m.id));
    const filteredInitialMemos = initialMemos.filter(m => !sentMemoIds.has(m.id));

    const allCombinedMemos = [...draftsWithActivity, ...filteredInitialMemos, ...sentMemos];

    const filteredMemos = allCombinedMemos.filter(memo => {
      const isArchivedByCurrentUser = memo.archivedBy?.includes(loggedInUser.id);

      if (tab === 'archive') {
        return isArchivedByCurrentUser;
      }
      
      if (isArchivedByCurrentUser) return false;

      if (tab === 'inbox') {
        const isTo = memo.to.some(user => user.id === loggedInUser.id);
        const isCc = memo.cc.some(user => user.id === loggedInUser.id);
        const isCurrentHolder = memo.current_holder?.id === loggedInUser.id;
        return memo.status !== 'draft' && (isTo || isCc || isCurrentHolder);
      }
      if (tab === 'sent') {
        return memo.from.id === loggedInUser.id && memo.status !== 'draft';
      }
      if (tab === 'drafts') {
          return memo.status === 'draft' && memo.from.id === loggedInUser.id;
      }
      return false;
    }).sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    });
    
    setMemos(filteredMemos);

    if (filteredMemos.length > 0) {
        // If there's no selected memo, or the selected one is no longer in the list, select the first one.
        if (!selectedMemoId || !filteredMemos.some(m => m.id === selectedMemoId)) {
            setSelectedMemoId(filteredMemos[0].id);
        }
    } else {
        setSelectedMemoId(null);
    }
  }, [tab, selectedMemoId]);

  useEffect(() => {
    loadMemos();
    const handleStorageChange = () => loadMemos();
    window.addEventListener('storage', handleStorageChange);
    // This is for when the user clicks "New Memo" and a new draft is created.
    window.addEventListener('draft-created', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('draft-created', handleStorageChange);
    }
  }, [tab, loadMemos]);


  const selectedMemo = memos.find(memo => memo.id === selectedMemoId) || null;

  const getEmptyState = () => {
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

  return (
    <div className="grid md:grid-cols-[minmax(300px,_1fr)_2fr] gap-4 h-[calc(100vh-8rem)]">
      <Card className="no-print">
        {memos.length > 0 ? (
          <MemoList memos={memos} selectedMemoId={selectedMemoId} onSelectMemo={setSelectedMemoId} />
        ) : (
          <div className="h-full p-2">
            <EmptyState title={emptyState.title} description={emptyState.description} action={emptyState.action} />
          </div>
        )}
      </Card>
      <div className="h-full overflow-y-auto rounded-lg no-print">
        <MemoDisplay memo={selectedMemo} onUpdate={loadMemos} />
      </div>
      <div className="hidden print:block col-span-2">
         <MemoDisplay memo={selectedMemo} onUpdate={loadMemos} />
      </div>
    </div>
  )
}


export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
        </Suspense>
    )
}
