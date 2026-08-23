import { UserRoundX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { CustomerStatus } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

interface CustomerStatusBadgeProps {
  status: CustomerStatus
  className?: string
}

/**
 * `closed` renders distinctly from `active` — per S5, a closed-account case
 * is a win-back, not a resolution, so it must not read as a quiet default
 * state. `unknown` is shown literally, never blank or guessed.
 */
export function CustomerStatusBadge({
  status,
  className,
}: CustomerStatusBadgeProps) {
  if (status === "closed") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-transparent bg-state-error/10 text-state-error",
          className
        )}
      >
        <UserRoundX data-icon="inline-start" />
        Closed
      </Badge>
    )
  }

  if (status === "unknown") {
    return (
      <Badge
        variant="outline"
        className={cn("border-dashed text-muted-foreground", className)}
      >
        Unknown
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)}>
      Active
    </Badge>
  )
}
