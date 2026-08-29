import { Badge } from "@/components/ui/badge"
import type { Urgency } from "@/lib/social/types"
import { cn } from "@/lib/utils"

const label: Record<Urgency, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
}

// Reuses the three state tokens already carried by `severity-badge.tsx` and
// `priority-badge.tsx` — no new colour values, per `context/ui-context.md`.
const className: Record<Urgency, string> = {
  critical: "bg-state-error/10 text-state-error",
  high: "bg-state-pending/10 text-state-pending",
  normal: "bg-muted text-muted-foreground",
}

interface UrgencyBadgeProps {
  urgency: Urgency
  className?: string
}

export function UrgencyBadge({ urgency, className: extra }: UrgencyBadgeProps) {
  return (
    <Badge variant="outline" className={cn("border-transparent", className[urgency], extra)}>
      {label[urgency]}
    </Badge>
  )
}
