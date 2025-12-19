'use client'

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { memos as allMemos, loggedInUser } from "@/lib/data"
import type { MemoWithActivity, Memo } from "@/lib/types"
import { MemoList } from "@/components/memo-list"
import { MemoDisplay } from "@/components/memo-display"
import { Card } from "@/components/ui/card"

function DashboardContent() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") || "inbox"

  const [memos, setMemos] = useState<MemoWithActivity[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);

  useEffect(() => {
    let drafts: Memo[] = [];
    if (typeof window !== 'undefined') {
        const draftsFromStorage = localStorage.getItem('memo-drafts');
        drafts = draftsFromStorage ? JSON.parse(draftsFromStorage) : [];
    }

    const allCombinedMemos = [...drafts.map(d => ({...d, activity: []})), ...allMemos];

    const filteredMemos = allCombinedMemos.filter(memo => {
      if (tab === 'inbox') {
        return memo.status !== 'draft' && (memo.to.some(user => user.id === loggedInUser.id) || memo.cc.some(user => user.id === loggedInUser.id))
      }
      if (tab === 'sent') {
        return memo.status === 'sent' && memo.from.id === loggedInUser.id
      }
      if (tab === 'drafts') {
          return memo.status === 'draft';
      }
      if (tab === 'archive') {
        // Implement archive logic if needed
        return false;
      }
      return true
    })
    setMemos(filteredMemos);
    if (filteredMemos.length > 0) {
        setSelectedMemoId(filteredMemos[0].id)
    } else {
        setSelectedMemoId(null)
    }
  }, [tab])

  const selectedMemo = memos.find(memo => memo.id === selectedMemoId) || null

  return (
    <div className="grid md:grid-cols-[minmax(300px,_1fr)_2fr] gap-4 h-[calc(100vh-8rem)]">
      <Card>
        <MemoList memos={memos} selectedMemoId={selectedMemoId} onSelectMemo={setSelectedMemoId} />
      </Card>
      <div className="h-full overflow-y-auto rounded-lg">
        <MemoDisplay memo={selectedMemo} />
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
