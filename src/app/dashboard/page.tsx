'use client'

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { memos as initialMemos, loggedInUser } from "@/lib/data"
import type { MemoWithActivity, Memo } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"

function DashboardContent() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") || "inbox"

  const [memos, setMemos] = useState<MemoWithActivity[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);

  const loadMemos = useCallback(() => {
    let drafts: Memo[] = [];
    let sentMemos: MemoWithActivity[] = [];
    if (typeof window !== 'undefined') {
        const draftsFromStorage = localStorage.getItem('memo-drafts');
        drafts = draftsFromStorage ? JSON.parse(draftsFromStorage) : [];
        const sentMemosFromStorage = localStorage.getItem('memos');
        sentMemos = sentMemosFromStorage ? JSON.parse(sentMemosFromStorage) : [];
    }

    const allCombinedMemos = [...drafts.map(d => ({...d, activity: []})), ...initialMemos, ...sentMemos];

    const filteredMemos = allCombinedMemos.filter(memo => {
      if (tab === 'inbox') {
        const isRecipient = memo.to.some(user => user.id === loggedInUser.id) || memo.cc.some(user => user.id === loggedInUser.id);
        const isCurrentHolder = memo.current_holder?.id === loggedInUser.id;
        return memo.status !== 'draft' && (isRecipient || isCurrentHolder);
      }
      if (tab === 'sent') {
        return memo.from.id === loggedInUser.id && memo.status !== 'draft';
      }
      if (tab === 'drafts') {
          return memo.status === 'draft' && memo.from.id === loggedInUser.id;
      }
      if (tab === 'archive') {
        // Implement archive logic if needed
        return false;
      }
      return true
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    setMemos(filteredMemos);

    if (filteredMemos.length > 0) {
        if (!selectedMemoId || !filteredMemos.some(m => m.id === selectedMemoId)) {
            setSelectedMemoId(filteredMemos[0].id);
        }
    } else {
        setSelectedMemoId(null);
    }
  }, [tab, selectedMemoId]);

  useEffect(() => {
    loadMemos();
  }, [tab, loadMemos]);


  const selectedMemo = memos.find(memo => memo.id === selectedMemoId) || null

  return (
    <div className="grid md:grid-cols-[minmax(300px,_1fr)_2fr] gap-4 h-[calc(100vh-8rem)]">
      <Card>
        <MemoList memos={memos} selectedMemoId={selectedMemoId} onSelectMemo={setSelectedMemoId} />
      </Card>
      <div className="h-full overflow-y-auto rounded-lg">
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
