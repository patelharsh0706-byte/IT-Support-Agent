import { Badge } from "@/components/ui/badge"
import type { Priority } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

// Same 3-state-token mapping as `severity-badge.tsx` — priority and
// severity are distinct concepts (see architecture.md) but share a palette
// since no dedicated tokens exist yet.
const classNameByPriority: Record<Priority, string> = {
  high: "bg-state-error/10 text-state-error",
  medium: "bg-state-pending/10 text-state-pending",
  low: "bg-state-success/10 text-state-success",
}

interface PriorityBadgeProps {
  priority: Priority
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent capitalize",
        classNameByPriority[priority],
        className
      )}
    >
      {priority}
    </Badge>
  )
}
