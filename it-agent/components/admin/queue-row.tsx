import Link from "next/link"

import { SeverityBadge } from "@/components/shared/severity-badge"
import { CustomerStatusBadge } from "@/components/admin/customer-status-badge"
import { channelMeta } from "@/lib/mock/channels"
import type { GrievanceCase } from "@/lib/mock/types"
import { formatDuration } from "@/lib/format-duration"
import { queueGridColsClass as gridColsClass } from "@/lib/admin/queue-grid"

interface QueueRowProps {
  grievanceCase: GrievanceCase
}

export function QueueRow({ grievanceCase }: QueueRowProps) {
  const ChannelIcon = channelMeta[grievanceCase.channel].icon

  return (
    <Link
      href={`/admin/conversations/${grievanceCase.id}`}
      className={`${gridColsClass} border-b border-border px-4 py-3 text-[13px] transition-colors hover:bg-subtle`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <ChannelIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-label={channelMeta[grievanceCase.channel].label}
        />
        <span className="truncate text-foreground">{grievanceCase.summary}</span>
      </span>

      <SeverityBadge
        severity={grievanceCase.currentSeverity}
        changed={grievanceCase.severityChangedRecently}
      />

      <span className="text-muted-foreground">
        {formatDuration(grievanceCase.createdAt)}
      </span>

      <span className="text-muted-foreground">
        {grievanceCase.escalatedAt
          ? formatDuration(grievanceCase.escalatedAt)
          : "—"}
      </span>

      <CustomerStatusBadge status={grievanceCase.customerStatus} />

      <span className="truncate text-muted-foreground">
        {grievanceCase.contactedByCsrName ?? ""}
      </span>
    </Link>
  )
}
