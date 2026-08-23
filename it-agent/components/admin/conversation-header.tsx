"use client"

import { CheckCircle2, MoreHorizontal, PanelRight } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { channelMeta } from "@/lib/mock/channels"
import type { GrievanceCase } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface ConversationHeaderProps {
  grievanceCase: GrievanceCase
  isResolved: boolean
  isContextOpen: boolean
  onToggleContext: () => void
  onResolve: () => void
  onMarkUnattended: () => void
}

export function ConversationHeader({
  grievanceCase,
  isResolved,
  isContextOpen,
  onToggleContext,
  onResolve,
  onMarkUnattended,
}: ConversationHeaderProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar size="sm">
          <AvatarFallback>{initials(grievanceCase.customerName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14px] font-medium text-foreground">
              {grievanceCase.customerName}
            </p>
            <span className="shrink-0 text-[12px] text-muted-foreground">
              #{grievanceCase.id}
            </span>
          </div>
          <p className="truncate text-[12px] text-muted-foreground">
            {channelMeta[grievanceCase.channel].label}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isResolved}
          onClick={onResolve}
          className={cn(isResolved && "text-state-success")}
        >
          <CheckCircle2 data-icon="inline-start" />
          {isResolved ? "Resolved" : "Resolve"}
        </Button>

        <Button
          type="button"
          variant={isContextOpen ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Toggle case details"
          onClick={onToggleContext}
        >
          <PanelRight />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {grievanceCase.originalPostUrl ? (
              <DropdownMenuItem asChild>
                <a href={grievanceCase.originalPostUrl} target="_blank" rel="noreferrer">
                  View original post
                </a>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => navigator.clipboard?.writeText(grievanceCase.id)}
            >
              Copy case ID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkUnattended}>
              Mark as unattended
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
