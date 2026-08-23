import { ArrowUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Severity } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

// Reuses the 3 existing state tokens (no dedicated severity palette in
// ui-context.md yet) — high maps onto the error tone, medium onto pending,
// low onto success. Same mapping used by `priority-badge.tsx`.
const classNameBySeverity: Record<Severity, string> = {
  high: "bg-state-error/10 text-state-error",
  medium: "bg-state-pending/10 text-state-pending",
  low: "bg-state-success/10 text-state-success",
}

interface SeverityBadgeProps {
  severity: Severity
  /** Shows a "recently changed" indicator next to the badge. */
  changed?: boolean
  className?: string
}

export function SeverityBadge({
  severity,
  changed,
  className,
}: SeverityBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        className={cn(
          "border-transparent capitalize",
          classNameBySeverity[severity],
          className
        )}
      >
        {severity}
      </Badge>
      {changed ? (
        <ArrowUp
          className="size-3.5 text-state-error"
          aria-label="Severity recently increased"
        />
      ) : null}
    </span>
  )
}
