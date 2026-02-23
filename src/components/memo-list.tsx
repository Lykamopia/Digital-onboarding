'use client'

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { DashboardMemo, User, LoggedInUser } from "@/lib/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { useEffect, useState, MouseEvent, useMemo } from "react"
import { getLoggedInUser, archiveMemo, toggleMemoReadStatus, deleteDraft, acknowledgeMemo, toggleFavorite, duplicateMemo, toggleFlag } from "@/app/actions/memo"
import { StatusBadge } from "./status-badge"
import { Button } from "./ui/button"
import { Archive, Reply, MailOpen, Trash2, Undo2, Share2, CheckCircle, Star, Copy, Flag, Pin, PinOff } from "lucide-react"
import { toast } from "sonner"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Badge } from "./ui/badge"
import { useSettings } from "./settings-provider"

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

interface MemoItemProps {
    memo: DashboardMemo;
    selectedMemoId: string | null;
    onSelectMemo: (id: string) => void;
    loggedInUser: LoggedInUser | null;
    tab: string;
    onUpdate: () => void;
    setMemos: React.Dispatch<React.SetStateAction<DashboardMemo[]>>;
}

const MemoItem: React.FC<MemoItemProps> = ({ memo, selectedMemoId, onSelectMemo, loggedInUser, tab, onUpdate, setMemos }) => {
    const router = useRouter();

    if (!loggedInUser) return null;

    const unread = useMemo(() => {
        if (!loggedInUser) return false;
        
        const actorIdToCheck = loggedInUser.actingUser ? loggedInUser.actingUser.id : loggedInUser.id;

        const isRecipient = memo.to.some(user => user.id === loggedInUser.id) || 
                            memo.cc.some(user => user.id === loggedInUser.id) || 
                            memo.current_holder?.id === loggedInUser.id;
        
        if (!isRecipient) return false;

        const hasViewed = memo.activity.some(act => act.action === 'viewed' && act.actorId === actorIdToCheck);
        const hasAcknowledged = memo.acknowledgedBy?.some(u => u.id === loggedInUser.id);
        
        return !hasViewed && !hasAcknowledged;
    }, [memo, loggedInUser]);

    const getMemoStatus = (memo: DashboardMemo) => {
        return memo.status;
    }
    
    const getOrigin = (memo: DashboardMemo) => {
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
        toast.success(archive ? "Memo Archived" : "Memo Restored");
        onUpdate();
    }
    
    const handleDeleteDraft = async (memoId: string) => {
        await deleteDraft(memoId);
        toast.success("Draft Deleted");
        onUpdate();
    }

    const handleReply = (memoId: string) => {
        router.push(`/dashboard/new?replyTo=${memoId}`);
    }
    
    const handleAssign = (memoId: string) => {
        router.push(`/dashboard/new?assignFrom=${memoId}`);
    }

    const handleDuplicate = async (memoId: string) => {
        await duplicateMemo(memoId);
        toast.success("Memo Duplicated", { description: "A new draft has been created." });
    }

    const handleAcknowledge = async (memoId: string) => {
        const result = await acknowledgeMemo(memoId);
        if (result.success) {
            toast.success("Memo Acknowledged");
            onUpdate();
        } else {
            toast.error("Acknowledgement Failed", { description: result.error });
        }
    }
    
    const handleMarkAsRead = async (memo: DashboardMemo) => {
        const actorId = loggedInUser.actingUser ? loggedInUser.actingUser.id : loggedInUser.id;
        
        setMemos(prevMemos => prevMemos.map(m => {
            if (m.id === memo.id) {
                const newActivity = { actorId: actorId, action: 'viewed' as const };
                return { ...m, activity: [...m.activity, newActivity]};
            }
            return m;
        }));

        toast.info("Marked as Read");
        await toggleMemoReadStatus(memo.id);
    }
    
    const handleToggleFavorite = async (memoId: string) => {
        if (tab === 'favorites') {
            setMemos(prevMemos => prevMemos.filter(m => m.id !== memoId));
        } else {
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
                return newMemos.sort((a, b) => {
                    const aIsFav = (a.favoritedBy?.length ?? 0) > 0;
                    const bIsFav = (b.favoritedBy?.length ?? 0) > 0;
                    if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
            });
        }

        const result = await toggleFavorite(memoId);
        toast.success(result.isFavorited ? "Memo favorited" : "Memo unfavorited");
        
        if (tab !== 'favorites') {
            onUpdate();
        }
    };
    
    const handleToggleFlag = async (memoId: string) => {
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
        toast.success(result.isFlagged ? "Memo Flagged" : "Memo Unflagged");
        onUpdate();
    }

    const getDisplayName = (memo: DashboardMemo) => {
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

    const MemoActions = ({ memo }: { memo: DashboardMemo }) => {
        const { settings } = useSettings();
        const isDirectRecipient = loggedInUser && (memo.to.some(u => u.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id);
        const canReply = isDirectRecipient && loggedInUser && memo.fromId !== loggedInUser.id && (!loggedInUser.actingUser || loggedInUser.delegationPermissions?.includes('delegation:reply'));
        const canAssign = isDirectRecipient && (!loggedInUser.actingUser || loggedInUser.delegationPermissions?.includes('delegation:reply'));

        if (tab === 'drafts') {
             return (
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                     <div className="bg-background/90 backdrop-blur-md rounded-full shadow-lg border border-border p-1 flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete this draft.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteDraft(memo.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                    </div>
                 </div>
            )
        }
        
        if (tab === 'favorites') {
             return (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                    <div className="bg-background/90 backdrop-blur-md rounded-full shadow-lg border border-border p-1 flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50" onClick={(e) => handleActionClick(e, () => handleToggleFavorite(memo.id))}>
                                    <Star className="h-4 w-4 fill-current" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Unfavorite</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            )
        }

        if (tab === 'archive') {
            return (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                    <div className="bg-background/90 backdrop-blur-md rounded-full shadow-lg border border-border p-1 flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100" onClick={(e) => e.stopPropagation()}>
                                            <Undo2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Restore this memo?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This memo will be moved back to your inbox.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleArchive(memo.id, false)}>Restore</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TooltipTrigger>
                            <TooltipContent>Restore to Inbox</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            )
        }

        return (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <div className="bg-background/90 backdrop-blur-md rounded-full shadow-lg border border-border p-1 flex items-center gap-1">
                    {unread && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-blue-50 hover:text-blue-600" onClick={(e) => handleActionClick(e, () => handleMarkAsRead(memo))}>
                                    <MailOpen className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as Read</TooltipContent>
                        </Tooltip>
                    )}
                    {canReply && tab !== 'sent' && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-green-50 hover:text-green-600" onClick={(e) => handleActionClick(e, () => handleReply(memo.id))}>
                                    <Reply className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reply</TooltipContent>
                        </Tooltip>
                    )}
                    {canAssign && (
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-purple-50 hover:text-purple-600" onClick={(e) => handleActionClick(e, () => handleAssign(memo.id))}>
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Assign</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100" onClick={(e) => e.stopPropagation()}>
                                        <Archive className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Archive this memo?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will move the memo to your personal archive. You can access it later from the Archive folder.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleArchive(memo.id, true)}>Archive</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        )
    }

    const isFavorited = (tab === 'favorites') || (memo.favoritedBy && memo.favoritedBy.length > 0);
    const isFlaggedByUser = memo.flaggedBy && memo.flaggedBy.length > 0;
    const showFavorite = tab !== 'drafts' && tab !== 'scheduled' && tab !== 'archive';
    
    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div
                    data-testid="memo-item"
                    className={cn(
                    "group relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition-all duration-200 cursor-pointer overflow-hidden",
                    "hover:bg-primary/[0.03] hover:border-primary/20",
                    selectedMemoId === memo.id ? "bg-primary/[0.08] ring-1 ring-primary/30 border-primary/30" : "bg-card",
                    isFlaggedByUser && "border-l-4 border-l-red-500/70"
                    )}
                    onClick={() => onSelectMemo(memo.id)}
                >
                    {/* Metadata Header Row */}
                    <div className="flex w-full items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {unread && (
                                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                )}
                                <div className={cn("truncate text-xs sm:text-sm transition-all", unread ? "font-bold text-foreground" : "font-semibold text-muted-foreground")}>
                                    {getDisplayName(memo)}
                                </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                                {(tab === 'inbox' || tab === 'scheduled' || (tab === 'favorites' && memo.fromId !== loggedInUser.id)) && (
                                    <StatusBadge status={getMemoStatus(memo)} />
                                )}
                                {tab === 'favorites' && (
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 px-1.5 font-normal bg-muted/50 border-none uppercase tracking-tight">
                                        {getOrigin(memo).replace('From ', '')}
                                    </Badge>
                                )}
                                {tab === 'archive' && <StatusBadge status="closed" />}
                            </div>
                        </div>
                        <div className="text-[10px] sm:text-xs shrink-0 text-muted-foreground whitespace-nowrap pt-0.5 font-medium tabular-nums">
                            {memo.createdAt ? formatDistanceToNow(new Date(memo.createdAt), { addSuffix: true }) : ''}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="w-full relative">
                        {/* Reserved padding for hover actions */}
                        <div className="pr-20 min-w-0 flex flex-col gap-0.5">
                            <div className={cn("text-sm truncate flex items-center gap-2", unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground/90")}>
                                {showFavorite && (
                                    <button 
                                        onClick={(e) => handleActionClick(e, () => handleToggleFavorite(memo.id))} 
                                        className={cn("z-10 shrink-0 transition-transform active:scale-90")}
                                    >
                                        <Star className={cn("h-4 w-4 transition-colors hover:text-yellow-500", isFavorited ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground/40")} />
                                    </button>
                                )}
                                <span className="truncate">{memo.subject || "(No Subject)"}</span>
                            </div>
                            
                            {memo.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                    {memo.labels.map(label => (
                                        <span 
                                            key={label.id}
                                            style={{ 
                                                backgroundColor: hexToRgba(label.color, 0.15), 
                                                color: label.color, 
                                                borderColor: hexToRgba(label.color, 0.3) 
                                            }} 
                                            className="px-1.5 py-0 rounded-full text-[9px] font-bold border leading-tight uppercase tracking-wider"
                                        >
                                            {label.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                            
                            <div 
                                className="line-clamp-1 text-xs text-muted-foreground/70 break-all mt-0.5 font-normal leading-relaxed" 
                                dangerouslySetInnerHTML={{ __html: memo.body?.replace(/<[^>]*>?/gm, ' ') || "No content preview available." }} 
                            />
                        </div>
                        
                        {/* Absolute positioned actions */}
                        <MemoActions memo={memo} />
                    </div>
                </div>
            </ContextMenuTrigger>
            
            <ContextMenuContent className="w-56">
                {tab === 'drafts' ? (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <ContextMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Draft</span>
                            </ContextMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently remove your unsent progress.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteDraft(memo.id)} className="bg-destructive">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : tab === 'archive' ? (
                    <ContextMenuItem onSelect={() => handleArchive(memo.id, false)}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        <span>Restore to Inbox</span>
                    </ContextMenuItem>
                ) : (
                    <>
                        <ContextMenuItem onSelect={() => handleToggleFavorite(memo.id)}>
                            <Star className={cn("mr-2 h-4 w-4", isFavorited && "fill-yellow-400 text-yellow-500")} />
                            <span>{isFavorited ? 'Unfavorite' : 'Favorite'}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => handleToggleFlag(memo.id)}>
                            <Flag className={cn("mr-2 h-4 w-4", isFlaggedByUser && "fill-red-500 text-red-500")} />
                            <span>{isFlaggedByUser ? 'Unflag' : 'Flag'}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => handleDuplicate(memo.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Duplicate</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        {unread && (
                            <ContextMenuItem onSelect={() => handleMarkAsRead(memo)}>
                                <MailOpen className="mr-2 h-4 w-4" />
                                <span>Mark as Read</span>
                            </ContextMenuItem>
                        )}
                        {memo.fromId !== loggedInUser.id && (
                            <ContextMenuItem onSelect={() => handleReply(memo.id)}>
                                <Reply className="mr-2 h-4 w-4" />
                                <span>Reply</span>
                            </ContextMenuItem>
                        )}
                        <ContextMenuItem onSelect={() => handleAssign(memo.id)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            <span>Assign</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => handleArchive(memo.id, true)}>
                             <Archive className="mr-2 h-4 w-4" />
                             <span>Archive</span>
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    )
}

const CollapsedView = ({ memos, selectedMemoId, onSelectMemo, loggedInUser }: { memos: DashboardMemo[], selectedMemoId: string | null, onSelectMemo: (id: string) => void, loggedInUser: LoggedInUser | null }) => {
    if (!loggedInUser) return null;
    
    const isUnread = (memo: DashboardMemo) => {
        const actorIdToCheck = loggedInUser.actingUser ? loggedInUser.actingUser.id : loggedInUser.id;
        const isRecipient = memo.to.some(user => user.id === loggedInUser.id) || memo.cc.some(user => user.id === loggedInUser.id) || memo.current_holder?.id === loggedInUser.id;
        return isRecipient && !memo.activity.some(act => act.action === 'viewed' && act.actorId === actorIdToCheck);
    }
    return (
        <TooltipProvider>
            <div className="flex flex-col items-center gap-3 p-2">
                {memos.map((memo) => (
                     <Tooltip key={memo.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                            <button
                                className={cn(
                                    "relative rounded-full transition-transform active:scale-95",
                                    selectedMemoId === memo.id ? "ring-2 ring-primary ring-offset-2" : "hover:scale-105"
                                )}
                                onClick={() => onSelectMemo(memo.id)}
                            >
                                <Avatar className="h-10 w-10 border border-border shadow-sm">
                                    <AvatarImage src={memo.from.avatar || undefined} alt={memo.from.name} />
                                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{memo.from.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {isUnread(memo) && (
                                    <span className="absolute -top-0.5 -right-0.5 block h-3 w-3 rounded-full bg-blue-500 border-2 border-background shadow-sm" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="flex flex-col gap-1 max-w-[200px]">
                           <p className="font-bold text-xs truncate">{memo.from.name}</p>
                           <p className="text-[10px] leading-tight line-clamp-2 text-muted-foreground">{memo.subject}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    )
}

interface MemoListProps {
  memos: DashboardMemo[]
  setMemos: React.Dispatch<React.SetStateAction<DashboardMemo[]>>
  selectedMemoId: string | null
  onSelectMemo: (id: string) => void
  isExpanded: boolean
  tab: string
  onUpdate: () => void;
  user: LoggedInUser | null;
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
                <div className="flex flex-col gap-1.5 px-3 py-3">
                    {memos.map((memo) => (
                        <MemoItem 
                            key={memo.id}
                            memo={memo}
                            selectedMemoId={selectedMemoId}
                            onSelectMemo={handleSelect}
                            loggedInUser={loggedInUser}
                            tab={tab}
                            onUpdate={onUpdate}
                            setMemos={setMemos}
                        />
                    ))}
                </div>
            ) : (
                <CollapsedView memos={memos} selectedMemoId={selectedMemoId} onSelectMemo={handleSelect} loggedInUser={loggedInUser}/>
            )}
        </TooltipProvider>
    </ScrollArea>
  )
}
