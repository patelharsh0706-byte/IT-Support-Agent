import { Badge } from "@/components/ui/badge"
import type { TicketStatus } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

/**
 * Customer-facing label for each stored status. The stored values mirror
 * `service_request.status`, so "open" is presented as "Raised" here rather
 * than renamed in the type.
 */
export const ticketStatusLabel: Record<TicketStatus, string> = {
  open: "Raised",
  in_progress: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
}

const classNameByStatus: Record<TicketStatus, string> = {
  open: "bg-state-pending/10 text-state-pending",
  // `--color-primary` resolves to `--accent-primary` (globals.css).
  in_progress: "bg-primary/10 text-primary",
  escalated: "bg-state-error/10 text-state-error",
  resolved: "bg-state-success/10 text-state-success",
}

interface TicketStatusBadgeProps {
  status: TicketStatus
  className?: string
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", classNameByStatus[status], className)}
    >
      {ticketStatusLabel[status]}
    </Badge>
  )
}
