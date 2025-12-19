'use client'

import {
  Archive,
  CheckCircle,
  Clock,
  Paperclip,
  Reply,
  Share2,
  User,
} from "lucide-react"

import type { MemoWithActivity } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTimestamp } from "@/lib/data"

interface MemoDisplayProps {
  memo: MemoWithActivity | null
}

const actionIcons = {
  sent: <Share2 className="h-4 w-4" />,
  viewed: <CheckCircle className="h-4 w-4 text-blue-500" />,
  acknowledged: <CheckCircle className="h-4 w-4 text-green-500" />,
  commented: <Reply className="h-4 w-4" />,
  delegated: <Share2 className="h-4 w-4 text-purple-500" />,
  created: <Share2 className="h-4 w-4" />,
}

export function MemoDisplay({ memo }: MemoDisplayProps) {
  if (!memo) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>Select a memo to read</p>
          <p className="text-sm">or create a new one to get started.</p>
        </div>
      </Card>
    )
  }

  const allRecipients = [...memo.to, ...memo.cc]

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-headline text-2xl mb-2">{memo.subject}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-6 w-6">
                <AvatarImage src={memo.from.avatar} />
                <AvatarFallback>{memo.from.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span>{memo.from.name}</span>
              <span>&lt;{memo.from.email}&gt;</span>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
             <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatTimestamp(memo.createdAt)}
             </div>
          </div>
        </div>

        <Separator className="my-4" />
        
        <div className="flex items-center space-x-4 text-sm">
            <TooltipProvider>
                <div className="flex items-center gap-2">
                    <span className="font-medium">To:</span>
                    {memo.to.map(user => (
                        <Tooltip key={user.id}>
                            <TooltipTrigger>
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={user.avatar} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{user.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
                 {memo.cc.length > 0 && 
                    <div className="flex items-center gap-2">
                        <span className="font-medium">CC:</span>
                        {memo.cc.map(user => (
                            <Tooltip key={user.id}>
                                <TooltipTrigger>
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={user.avatar} />
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{user.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                }
            </TooltipProvider>
        </div>
        
      </CardHeader>

      <CardContent>
        <div className="prose max-w-none text-sm dark:prose-invert">
          {memo.body.split('\n').map((line, index) => <p key={index}>{line}</p>)}
        </div>
        
        {memo.attachments.length > 0 && (
          <>
            <Separator className="my-6" />
            <h3 className="text-sm font-medium mb-2">Attachments</h3>
            <div className="flex flex-wrap gap-2">
              {memo.attachments.map((att) => (
                <Button key={att.id} variant="outline" size="sm" asChild>
                  <a href={att.url} download={att.name}>
                    <Paperclip className="h-4 w-4 mr-2" />
                    {att.name} ({att.size})
                  </a>
                </Button>
              ))}
            </div>
          </>
        )}
        
        <Separator className="my-6" />

        <div className="flex items-center gap-2">
            <Button variant="outline"><CheckCircle className="mr-2 h-4 w-4"/>Acknowledge</Button>
            <Button variant="outline"><Reply className="mr-2 h-4 w-4"/>Reply</Button>
            <Button variant="outline"><Share2 className="mr-2 h-4 w-4"/>Delegate</Button>
            <Button variant="ghost" size="icon"><Archive className="h-4 w-4 text-muted-foreground"/></Button>
        </div>

        <Separator className="my-6" />
        
        <div>
          <h3 className="text-sm font-medium mb-4">Activity History</h3>
          <ul className="space-y-4">
            {memo.activity.map((act) => (
              <li key={act.id} className="flex items-start gap-3">
                 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {actionIcons[act.action] || <User className="h-4 w-4"/>}
                </span>
                <div className="flex-1 pt-1">
                  <p className="text-sm">
                    <span className="font-medium">{act.actor.name}</span>
                    <span className="text-muted-foreground"> {act.action} this memo.</span>
                  </p>
                  {act.details && <p className="text-sm text-muted-foreground mt-1 pl-4 border-l-2 ml-2">{act.details}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(act.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
