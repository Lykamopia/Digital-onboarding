

'use client'

import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { MemoWithActivity } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { loggedInUser } from "@/lib/data"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

interface MemoListProps {
  memos: MemoWithActivity[]
  selectedMemoId: string | null
  onSelectMemo: (id: string) => void
  isExpanded: boolean
}

const ExpandedView = ({ memos, selectedMemoId, handleSelect }: { memos: MemoWithActivity[], selectedMemoId: string | null, handleSelect: (memo: MemoWithActivity) => void }) => (
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
                <div className="font-semibold truncate">{memo.status === 'draft' ? 'Draft' : memo.from.name}</div>
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
            <div className="text-sm font-medium truncate">{memo.subject || "No Subject"}</div>
            </div>
            <div className="line-clamp-1 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: memo.body.substring(0, 300) || "No content" }} />
        </button>
        ))}
    </div>
)

const CollapsedView = ({ memos, selectedMemoId, handleSelect }: { memos: MemoWithActivity[], selectedMemoId: string | null, handleSelect: (memo: MemoWithActivity) => void }) => {
    const isUnread = (memo: MemoWithActivity) => {
        const isRecipient = memo.to.some(user => user.id === loggedInUser.id) || memo.cc.some(user => user.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id;
        return isRecipient && !memo.activity.some(act => act.action === 'viewed' && act.actor.id === loggedInUser.id);
    }
    return (
        <TooltipProvider>
            <div className="flex flex-col items-center gap-2 p-2">
                {memos.map((memo) => (
                     <Tooltip key={memo.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                            <button
                                className={cn(
                                    "relative rounded-full p-0.5",
                                    selectedMemoId === memo.id && "bg-primary/20"
                                )}
                                onClick={() => handleSelect(memo)}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={memo.from.avatar} alt={memo.from.name} />
                                    <AvatarFallback>{memo.from.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {isUnread(memo) && (
                                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-background" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                           <p className="font-semibold">{memo.from.name}</p>
                           <p>{memo.subject}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    )
}

export function MemoList({ memos, selectedMemoId, onSelectMemo, isExpanded }: MemoListProps) {
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
      {isExpanded ? (
        <ExpandedView memos={memos} selectedMemoId={selectedMemoId} handleSelect={handleSelect} />
      ) : (
        <CollapsedView memos={memos} selectedMemoId={selectedMemoId} handleSelect={handleSelect} />
      )}
    </ScrollArea>
  )
}
