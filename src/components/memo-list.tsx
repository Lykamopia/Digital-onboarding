'use client'

import { cn } from "@/lib/utils"
import type { MemoWithActivity } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatTimestamp } from "@/lib/data"
import { Badge } from "@/components/ui/badge"

interface MemoListProps {
  memos: MemoWithActivity[]
  selectedMemoId: string | null
  onSelectMemo: (id: string) => void
}

export function MemoList({ memos, selectedMemoId, onSelectMemo }: MemoListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {memos.map((memo) => (
          <button
            key={memo.id}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
              selectedMemoId === memo.id && "bg-muted"
            )}
            onClick={() => onSelectMemo(memo.id)}
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{memo.from.name}</div>
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs",
                    selectedMemoId === memo.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {formatTimestamp(memo.createdAt)}
                </div>
              </div>
              <div className="text-xs font-medium">{memo.subject}</div>
            </div>
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {memo.body.substring(0, 300)}
            </div>
             <div className="flex items-center gap-2">
                {memo.status === 'acknowledged' && <Badge variant="default" className="bg-green-600">Acknowledged</Badge>}
                {memo.status === 'read' && <Badge variant="secondary">Read</Badge>}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
