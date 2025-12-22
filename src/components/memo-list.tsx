'use client'

import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { MemoWithActivity } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"

interface MemoListProps {
  memos: MemoWithActivity[]
  selectedMemoId: string | null
  onSelectMemo: (id: string) => void
}

export function MemoList({ memos, selectedMemoId, onSelectMemo }: MemoListProps) {
  const router = useRouter();

  const handleSelect = (memo: MemoWithActivity) => {
    if (memo.status === 'draft') {
      router.push(`/dashboard/new?id=${memo.id}`);
    } else {
      onSelectMemo(memo.id);
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0.5 p-1">
        {memos.map((memo) => (
          <button
            key={memo.id}
            className={cn(
              "flex flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-colors",
              "hover:bg-primary/5",
              selectedMemoId === memo.id ? "bg-primary/10 border-primary/20" : "border-transparent"
            )}
            onClick={() => handleSelect(memo)}
          >
            <div className="flex w-full flex-col gap-0.5">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{memo.status === 'draft' ? 'Draft' : memo.from.name}</div>
                  {memo.status === 'draft' && <Badge variant="secondary">Draft</Badge>}
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs",
                    selectedMemoId === memo.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {memo.createdAt ? formatDistanceToNow(new Date(memo.createdAt), { addSuffix: true }) : ''}
                </div>
              </div>
              <div className="text-sm font-medium">{memo.subject || "No Subject"}</div>
            </div>
            <div className="line-clamp-1 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: memo.body.substring(0, 300) || "No content" }} />
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
