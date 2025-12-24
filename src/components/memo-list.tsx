

'use client'

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { MemoWithActivity, User } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { useEffect, useState, MouseEvent } from "react"
import { getLoggedInUser, archiveMemo, toggleMemoReadStatus } from "@/app/actions/memo"
import { StatusBadge } from "./status-badge"
import { Button } from "./ui/button"
import { Archive, Reply, Mail, MailOpen } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MemoListProps {
  memos: MemoWithActivity[]
  setMemos: React.Dispatch<React.SetStateAction<MemoWithActivity[]>>
  selectedMemoId: string | null
  onSelectMemo: (id: string) => void
  isExpanded: boolean
}

const ExpandedView = ({ memos, setMemos, selectedMemoId, onSelectMemo, loggedInUser }: { memos: MemoWithActivity[], setMemos: React.Dispatch<React.SetStateAction<MemoWithActivity[]>>, selectedMemoId: string | null, onSelectMemo: (id: string) => void, loggedInUser: User | null }) => {
    
    const { toast } = useToast();
    const router = useRouter();
    if (!loggedInUser) return null;

    const getMemoStatus = (memo: MemoWithActivity) => {
        if (memo.status === 'draft') return 'draft';
        const isRecipient = memo.to.some(user => user.id === loggedInUser!.id) || memo.cc.some(user => user.id === loggedInUser!.id) || memo.current_holder?.id === loggedInUser!.id;
        if (!isRecipient) return memo.status;

        const hasAcknowledged = memo.acknowledgedBy?.some(u => u.id === loggedInUser!.id);
        if (hasAcknowledged) return 'acknowledged';
        
        const hasViewed = memo.activity.some(act => act.action === 'viewed' && act.actorId === loggedInUser!.id);
        if (hasViewed) return 'read';
        
        return 'unread';
    }

    const isMemoUnread = (memo: MemoWithActivity) => {
        const status = getMemoStatus(memo);
        return status === 'unread';
    }

    const handleActionClick = (e: MouseEvent, callback: () => void) => {
        e.stopPropagation();
        callback();
    }

    const handleArchive = async (memoId: string) => {
        // Optimistic update
        setMemos(prev => prev.filter(m => m.id !== memoId));
        toast({ title: "Memo Archived" });
        await archiveMemo(memoId, true);
    }

    const handleReply = (memoId: string) => {
        router.push(`/dashboard/new?replyTo=${memoId}`);
    }

    const handleToggleRead = async (memo: MemoWithActivity) => {
        const isNowUnread = !isMemoUnread(memo);
        
        // Optimistic update
        setMemos(prevMemos => prevMemos.map(m => {
            if (m.id === memo.id) {
                if (isNowUnread) {
                    // It was read, now unread - remove 'viewed' activity
                    return { ...m, activity: m.activity.filter(a => !(a.actorId === loggedInUser.id && a.action === 'viewed')) };
                } else {
                    // It was unread, now read - add 'viewed' activity
                    const newActivity = { id: 'temp', actorId: loggedInUser.id, action: 'viewed', timestamp: new Date().toISOString(), actor: loggedInUser, details: '' };
                    return { ...m, activity: [...m.activity, newActivity]};
                }
            }
            return m;
        }));

        toast({ title: isNowUnread ? "Marked as Unread" : "Marked as Read" });
        await toggleMemoReadStatus(memo.id);
    }

    const MemoActions = ({ memo }: { memo: MemoWithActivity }) => (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-full border bg-card p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleActionClick(e, () => handleToggleRead(memo))}>
                        {isMemoUnread(memo) ? <MailOpen /> : <Mail />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{isMemoUnread(memo) ? 'Mark as Read' : 'Mark as Unread'}</TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleActionClick(e, () => handleReply(memo.id))}>
                        <Reply />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Reply</TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleActionClick(e, () => handleArchive(memo.id))}>
                        <Archive />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Archive</TooltipContent>
            </Tooltip>
        </div>
    )

    return (
        <div className="flex flex-col gap-0.5 p-1">
            {memos.map((memo) => (
            <div
                key={memo.id}
                className={cn(
                "group relative flex flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-all duration-200 cursor-pointer",
                "hover:bg-primary/5",
                selectedMemoId === memo.id ? "bg-primary/10 ring-2 ring-primary/50" : ""
                )}
                onClick={() => onSelectMemo(memo.id)}
            >
                <div className="flex w-full flex-col gap-0.5">
                    <div className="flex items-center">
                        <div className="flex items-center gap-2 truncate">
                            <div className="font-semibold truncate">{memo.from.name}</div>
                            <StatusBadge status={getMemoStatus(memo)} />
                        </div>
                        <div
                        className={cn(
                            "ml-auto text-xs shrink-0 transition-opacity duration-300",
                            "group-hover:opacity-0",
                            selectedMemoId === memo.id
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                        >
                        {memo.createdAt ? formatDistanceToNow(new Date(memo.createdAt), { addSuffix: true }) : ''}
                        </div>
                    </div>
                    <div className="text-sm font-medium truncate pr-24">{memo.subject || "No Subject"}</div>
                </div>
                <div className="line-clamp-1 text-xs text-muted-foreground break-words pr-24" dangerouslySetInnerHTML={{ __html: memo.body?.substring(0, 300) || "No content" }} />
                <MemoActions memo={memo} />
            </div>
            ))}
        </div>
    )
}

const CollapsedView = ({ memos, selectedMemoId, onSelectMemo, loggedInUser }: { memos: MemoWithActivity[], selectedMemoId: string | null, onSelectMemo: (id: string) => void, loggedInUser: User | null }) => {
    
    if (!loggedInUser) return null;
    
    const isUnread = (memo: MemoWithActivity) => {
        const isRecipient = memo.to.some(user => user.id === loggedInUser.id) || memo.cc.some(user => user.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id;
        return isRecipient && !memo.activity.some(act => act.action === 'viewed' && act.actorId === loggedInUser.id);
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
                                onClick={() => onSelectMemo(memo.id)}
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

export function MemoList({ memos, setMemos, selectedMemoId, onSelectMemo, isExpanded }: MemoListProps) {
  const router = useRouter();
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  
  useEffect(() => {
    getLoggedInUser().then(user => setLoggedInUser(user as User));
  }, []);

  const handleSelect = (memo: MemoWithActivity) => {
    if (memo.status === 'draft') {
      router.push(`/dashboard/new?id=${memo.id}`);
    } else {
        onSelectMemo(memo.id);
    }
  }

  return (
    <ScrollArea className="h-full">
        <TooltipProvider>
            {isExpanded ? (
                <ExpandedView memos={memos} setMemos={setMemos} selectedMemoId={selectedMemoId} onSelectMemo={onSelectMemo} loggedInUser={loggedInUser}/>
            ) : (
                <CollapsedView memos={memos} selectedMemoId={selectedMemoId} onSelectMemo={onSelectMemo} loggedInUser={loggedInUser}/>
            )}
        </TooltipProvider>
    </ScrollArea>
  )
}
