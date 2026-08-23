import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SeverityBadge } from "@/components/shared/severity-badge"
import { CustomerStatusBadge } from "@/components/admin/customer-status-badge"
import { channelMeta } from "@/lib/mock/channels"
import { caseLastActivityAt, casePreviewText } from "@/lib/mock/case-thread"
import { formatDuration } from "@/lib/format-duration"
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

interface ConversationListRowProps {
  grievanceCase: GrievanceCase
  isActive: boolean
  href: string
}

export function ConversationListRow({
  grievanceCase,
  isActive,
  href,
}: ConversationListRowProps) {
  const ChannelIcon = channelMeta[grievanceCase.channel].icon

  return (
    <Link
      href={href}
      aria-current={isActive || undefined}
      className={cn(
        "flex flex-col gap-1.5 border-b border-border px-4 py-3 transition-colors hover:bg-subtle",
        isActive && "bg-subtle"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative shrink-0">
          <Avatar size="sm">
            <AvatarFallback>{initials(grievanceCase.customerName)}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-surface ring-1 ring-border">
            <ChannelIcon className="size-2.5 text-muted-foreground" />
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
          {grievanceCase.customerName}
        </span>
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {formatDuration(caseLastActivityAt(grievanceCase))}
        </span>
      </div>

      <p className="line-clamp-2 text-[13px] text-muted-foreground">
        {casePreviewText(grievanceCase)}
      </p>

      <div className="flex items-center gap-1.5">
        <SeverityBadge severity={grievanceCase.currentSeverity} />
        <CustomerStatusBadge status={grievanceCase.customerStatus} />
      </div>
    </Link>
  )
}
