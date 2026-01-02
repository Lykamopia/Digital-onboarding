
'use client'

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { MemoWithActivity, User } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { useEffect, useState, MouseEvent } from "react"
import { getLoggedInUser, archiveMemo, toggleMemoReadStatus, deleteDraft, acknowledgeMemo, toggleFavorite, duplicateMemo, toggleFlag } from "@/app/actions/memo"
import { StatusBadge } from "./status-badge"
import { Button } from "./ui/button"
import { Archive, Reply, Mail, MailOpen, Trash2, Undo2, Share2, CheckCircle, Star, Copy, Flag, Pin, PinOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu"
import { ForwardDialog } from "./forward-dialog"
import { Badge } from "./ui/badge"

function hexToRgba(hex: string, alpha: number) {
    if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        return `rgba(200, 200, 200, ${alpha})`; // fallback color
    }
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const i = parseInt(c.join(''), 16);
    return `rgba(${(i >> 16) & 255}, ${(i >> 8) & 255}, ${i & 255}, ${alpha})`;
}

interface MemoListProps {
  memos: MemoWithActivity[]
  setMemos: React.Dispatch<React.SetStateAction<MemoWithActivity[]>>
  selectedMemoId: string | null
  onSelectMemo: (id: string) => void
  isExpanded: boolean
  tab: string
  onUpdate: () => void;
  user: User | null;
}

const ExpandedView = ({ tab, memos, setMemos, selectedMemoId, onSelectMemo, loggedInUser, onUpdate }: { tab: string, memos: MemoWithActivity[], setMemos: React.Dispatch<React.SetStateAction<MemoWithActivity[]>>, selectedMemoId: string | null, onSelectMemo: (id: string) => void, loggedInUser: User | null, onUpdate: () => void }) => {
    
    const { toast } = useToast();
    const router = useRouter();
    if (!loggedInUser) return null;

    const getMemoStatus = (memo: MemoWithActivity) => {
        if (memo.status === 'draft') return 'draft';
        if (memo.status === 'scheduled') return 'scheduled';

        const lastActivity = memo.activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        if(lastActivity?.action === 'forwarded' && memo.current_holderId === loggedInUser.id) {
            return 'delegated';
        }

        const isRecipient = memo.to.some(user => user.id === loggedInUser!.id) || memo.cc.some(user => user.id === loggedInUser!.id) || memo.current_holder?.id === loggedInUser!.id;
        if (!isRecipient) return memo.status;

        const hasAcknowledged = memo.acknowledgedBy?.some(u => u.id === loggedInUser!.id);
        if (hasAcknowledged) return 'acknowledged';
        
        const hasViewed = memo.activity.some(act => act.action === 'viewed' && act.actorId === loggedInUser!.id);
        if (hasViewed) return 'read';
        
        return 'unread';
    }
    
    const getOrigin = (memo: MemoWithActivity) => {
        if (memo.fromId === loggedInUser.id) return "From Sent";
        if (memo.status === 'draft') return "From Drafts";
        if (memo.archivedBy?.some(u => u.id === loggedInUser.id)) return "From Archive";
        return "From Inbox";
    }

    const handleActionClick = (e: MouseEvent, callback: () => void) => {
        e.stopPropagation();
        callback();
    }
    
    const handleArchive = async (memoId: string, archive: boolean) => {
        await archiveMemo(memoId, archive);
        toast({ title: archive ? "Memo Archived" : "Memo Restored" });
        onUpdate();
    }
    
    const handleDeleteDraft = async (memoId: string) => {
        await deleteDraft(memoId);
        toast({ title: "Draft Deleted" });
        onUpdate();
    }

    const handleReply = (memoId: string) => {
        router.push(`/dashboard/new?replyTo=${memoId}`);
    }
    
    const handleForward = (memoId: string) => {
        router.push(`/dashboard/new?forwardFrom=${memoId}`);
    }

    const handleDuplicate = async (memoId: string) => {
        await duplicateMemo(memoId);
        toast({ title: "Memo Duplicated", description: "A new draft has been created." });
    }

    const handleAcknowledge = async (memoId: string) => {
        await acknowledgeMemo(memoId);
        toast({ title: "Memo Acknowledged" });
        onUpdate();
    }
    
    const handleMarkAsRead = async (memo: MemoWithActivity) => {
        // Optimistic update
        setMemos(prevMemos => prevMemos.map(m => {
            if (m.id === memo.id) {
                const newActivity = { id: 'temp', actorId: loggedInUser.id, action: 'viewed' as const, timestamp: new Date().toISOString(), actor: loggedInUser, details: '' };
                return { ...m, activity: [...m.activity, newActivity]};
            }
            return m;
        }));

        toast({ title: "Marked as Read" });
        await toggleMemoReadStatus(memo.id);
    }
    
    const handleToggleFavorite = async (memoId: string) => {
        // Optimistic update
        setMemos(prevMemos => {
            const newMemos = prevMemos.map(m => {
                if (m.id === memoId) {
                    const isFavorited = m.favoritedBy && m.favoritedBy.length > 0;
                    return {
                        ...m,
                        favoritedBy: isFavorited ? [] : [{ id: loggedInUser.id }]
                    };
                }
                return m;
            });
            // Re-sort based on new favorite status
            return newMemos.sort((a, b) => {
                const aIsFav = (a.favoritedBy?.length ?? 0) > 0;
                const bIsFav = (b.favoritedBy?.length ?? 0) > 0;
                if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
        });

        const result = await toggleFavorite(memoId);
        toast({ title: result.isFavorited ? "Memo favorited" : "Memo unfavorited" });
        onUpdate();
    };
    
    const handleToggleFlag = async (memoId: string) => {
        // Optimistic update
        setMemos(prevMemos => prevMemos.map(m => {
            if (m.id === memoId) {
                const isFlagged = m.flaggedBy && m.flaggedBy.length > 0;
                return {
                    ...m,
                    flaggedBy: isFlagged ? [] : [{ id: loggedInUser.id }]
                };
            }
            return m;
        }));

        const result = await toggleFlag(memoId);
        toast({
            title: result.isFlagged ? "Memo Flagged" : "Memo Unflagged",
        });
        onUpdate();
    }

    const getDisplayName = (memo: MemoWithActivity) => {
        if (tab === 'sent' || tab === 'drafts' || tab === 'scheduled' || (tab === 'favorites' && memo.fromId === loggedInUser.id)) {
            if (memo.to.length > 0) {
                const mainRecipient = memo.to[0].name;
                const otherRecipientsCount = memo.to.length - 1 + memo.cc.length;
                if (otherRecipientsCount > 0) {
                    return `${mainRecipient}, +${otherRecipientsCount}`;
                }
                return mainRecipient;
            }
            return "No recipients";
        }
        return memo.from.name;
    }

    const MemoActions = ({ memo }: { memo: MemoWithActivity }) => {
        const memoStatus = getMemoStatus(memo);
        
        const isDirectRecipient = loggedInUser && (memo.to.some(u => u.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id);
        const canAcknowledge = (isDirectRecipient || (loggedInUser && memo.cc.some(u => u.id === loggedInUser.id))) && memoStatus !== 'acknowledged';
        const canReply = isDirectRecipient && loggedInUser && memo.fromId !== loggedInUser.id;
        const canForward = isDirectRecipient;

        // Conditional rendering logic
        if (tab === 'drafts') {
            return (
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                     <div className="bg-background/70 backdrop-blur-sm rounded-full shadow-md p-0.5 flex items-center gap-0.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-destructive hover:text-destructive" onClick={(e) => handleActionClick(e, () => handleDeleteDraft(memo.id))}>
                                    <Trash2 />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                    </div>
                 </div>
            )
        }

        return (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-background/70 backdrop-blur-sm rounded-full shadow-md p-0.5 flex items-center gap-0.5">
                    {memoStatus === 'unread' && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => handleActionClick(e, () => handleMarkAsRead(memo))}>
                                    <MailOpen />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as Read</TooltipContent>
                        </Tooltip>
                    )}
                    {canAcknowledge && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => handleActionClick(e, () => handleAcknowledge(memo.id))}>
                                    <CheckCircle />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Acknowledge</TooltipContent>
                        </Tooltip>
                    )}
                    {canReply && tab !== 'sent' && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => handleActionClick(e, () => handleReply(memo.id))}>
                                    <Reply />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reply</TooltipContent>
                        </Tooltip>
                    )}
                    {canForward && (
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => handleActionClick(e, () => handleForward(memo.id))}>
                                    <Share2 />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Forward</TooltipContent>
                        </Tooltip>
                    )}
                    {tab === 'archive' ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => handleActionClick(e, () => handleArchive(memo.id, false))}>
                                    <Undo2 />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Unarchive</TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => handleActionClick(e, () => handleArchive(memo.id, true))}>
                                    <Archive />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Archive</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
        )
    }

    const MemoContextMenu = ({ memo }: { memo: MemoWithActivity }) => {
        const memoStatus = getMemoStatus(memo);
        
        const isDirectRecipient = loggedInUser && (memo.to.some(u => u.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id);
        const canAcknowledge = (isDirectRecipient || (loggedInUser && memo.cc.some(u => u.id === loggedInUser.id))) && memoStatus !== 'acknowledged';
        const canReply = isDirectRecipient && loggedInUser && memo.fromId !== loggedInUser.id;
        const canForward = isDirectRecipient;
        const canDuplicate = loggedInUser.role.permissions.includes('manage_memos');
        const isFavorited = memo.favoritedBy && memo.favoritedBy.length > 0;
        const isFlaggedByUser = memo.flaggedBy && memo.flaggedBy.length > 0;
        
        if (tab === 'drafts') {
            return (
                <ContextMenuContent>
                    <ContextMenuItem onSelect={() => handleDeleteDraft(memo.id)} className="text-destructive" data-destructive>
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Draft</span>
                    </ContextMenuItem>
                </ContextMenuContent>
            );
        }

        return (
            <ContextMenuContent>
                <ContextMenuItem onSelect={() => handleToggleFavorite(memo.id)}>
                    <Star className={cn("mr-2 h-4 w-4", isFavorited && "fill-yellow-400 text-yellow-500")} />
                    <span>{isFavorited ? 'Unfavorite' : 'Favorite'}</span>
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => handleToggleFlag(memo.id)}>
                    <Flag className={cn("mr-2 h-4 w-4", isFlaggedByUser && "fill-red-500 text-red-500")} />
                    <span>{isFlaggedByUser ? 'Unflag' : 'Flag'}</span>
                </ContextMenuItem>
                {canDuplicate && (
                    <ContextMenuItem onSelect={() => handleDuplicate(memo.id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        <span>Duplicate</span>
                    </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                {memoStatus === 'unread' && (
                    <ContextMenuItem onSelect={() => handleMarkAsRead(memo)}>
                        <MailOpen className="mr-2 h-4 w-4" />
                        <span>Mark as Read</span>
                    </ContextMenuItem>
                )}
                {canAcknowledge && (
                    <ContextMenuItem onSelect={() => handleAcknowledge(memo.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        <span>Acknowledge</span>
                    </ContextMenuItem>
                )}
                {canReply && tab !== 'sent' && (
                    <ContextMenuItem onSelect={() => handleReply(memo.id)}>
                        <Reply className="mr-2 h-4 w-4" />
                        <span>Reply</span>
                    </ContextMenuItem>
                )}
                {canForward && (
                    <ContextMenuItem onSelect={() => handleForward(memo.id)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        <span>Forward</span>
                    </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                {tab === 'archive' ? (
                    <ContextMenuItem onSelect={() => handleArchive(memo.id, false)}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        <span>Unarchive</span>
                    </ContextMenuItem>
                ) : (
                    <ContextMenuItem onSelect={() => handleArchive(memo.id, true)}>
                        <Archive className="mr-2 h-4 w-4" />
                        <span>Archive</span>
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        )
    }

    return (
        <div className="flex flex-col gap-0.5 px-1 py-1">
            {memos.map((memo) => {
                const isFavorited = memo.favoritedBy && memo.favoritedBy.length > 0;
                const isFlaggedByUser = memo.flaggedBy && memo.flaggedBy.length > 0;
                return (
                <ContextMenu key={memo.id}>
                    <ContextMenuTrigger>
                        <div
                            className={cn(
                            "group relative flex flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-all duration-200 cursor-pointer",
                            "hover:bg-primary/5",
                            selectedMemoId === memo.id ? "bg-primary/10 ring-2 ring-primary/50" : "",
                            isFlaggedByUser && "border-l-4 border-l-red-500/70"
                            )}
                            onClick={() => onSelectMemo(memo.id)}
                        >
                            <div className="flex w-full items-start justify-between gap-2">
                                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                                    <div className="font-semibold truncate">{getDisplayName(memo)}</div>
                                    {(tab === 'inbox' || tab === 'scheduled' || tab === 'favorites') && <StatusBadge status={getMemoStatus(memo)} />}
                                    {tab === 'favorites' && <Badge variant="secondary" className="text-xs">{getOrigin(memo)}</Badge>}
                                </div>
                                <div
                                className={cn(
                                    "text-xs shrink-0 transition-opacity duration-300",
                                    "group-hover:opacity-0",
                                    selectedMemoId === memo.id
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                )}
                                >
                                {memo.createdAt ? formatDistanceToNow(new Date(memo.createdAt), { addSuffix: true }) : ''}
                                </div>
                            </div>

                            <div className="w-full pr-20 overflow-hidden">
                                <div className="text-sm font-medium truncate flex items-center gap-2">
                                     <button onClick={(e) => handleActionClick(e, () => handleToggleFavorite(memo.id))} className="z-10 shrink-0">
                                        <Star className={cn("h-4 w-4 text-muted-foreground transition-colors hover:text-yellow-500", isFavorited && "fill-yellow-400 text-yellow-500")} />
                                    </button>
                                    <span className="truncate">{memo.subject || "No Subject"}</span>
                                </div>
                                {memo.labels.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {memo.labels.map(label => (
                                             <span 
                                                key={label.id}
                                                style={{ 
                                                    backgroundColor: hexToRgba(label.color, 0.2), 
                                                    color: label.color, 
                                                    borderColor: hexToRgba(label.color, 0.4) 
                                                }} 
                                                className="px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
                                            >
                                                {label.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="line-clamp-1 text-xs text-muted-foreground break-words mt-1" dangerouslySetInnerHTML={{ __html: memo.body?.substring(0, 300) || "No content" }} />
                            </div>
                            
                            <MemoActions memo={memo} />
                        </div>
                    </ContextMenuTrigger>
                    <MemoContextMenu memo={memo} />
                </ContextMenu>
                )
            })}
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
                                    <AvatarImage src={memo.from.avatar || undefined} alt={memo.from.name} />
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

export function MemoList({ memos, setMemos, selectedMemoId, onSelectMemo, isExpanded, tab, onUpdate, user: loggedInUser }: MemoListProps) {
  const router = useRouter();
  
  const handleSelect = (memoId: string) => {
    const memo = memos.find(m => m.id === memoId);
    if (!memo) return;
    
    if (memo.status === 'draft') {
      router.push(`/dashboard/new?id=${memo.id}`);
    } else {
        onSelectMemo(memo.id);
    }
  }

  return (
    <ScrollArea className="h-full [&>[data-radix-scroll-area-scrollbar]]:hidden">
        <TooltipProvider>
            {isExpanded ? (
                <ExpandedView tab={tab} memos={memos} setMemos={setMemos} selectedMemoId={selectedMemoId} onSelectMemo={handleSelect} loggedInUser={loggedInUser} onUpdate={onUpdate} />
            ) : (
                <CollapsedView memos={memos} selectedMemoId={selectedMemoId} onSelectMemo={handleSelect} loggedInUser={loggedInUser}/>
            )}
        </TooltipProvider>
    </ScrollArea>
  )
}
