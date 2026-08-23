import { Ban } from "lucide-react"

import type { ActivityEvent, ActivityStatus } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

const dotClassByStatus: Record<Exclude<ActivityStatus, "denied">, string> = {
  running: "bg-state-pending animate-pulse",
  ok: "bg-state-success",
  failed: "bg-state-error",
}

interface ActivityEventRowProps {
  event: ActivityEvent
  className?: string
}

/**
 * One row in an activity stream: status indicator, stage label, optional
 * mono detail line. `denied` gets a muted icon rather than a colored dot —
 * ui-context.md defines no 4th status color, so this stays a neutral/muted
 * treatment instead of inventing a new hue.
 */
export function ActivityEventRow({ event, className }: ActivityEventRowProps) {
  return (
    <div className={cn("flex items-start gap-2.5 py-2", className)}>
      <span className="mt-1 flex size-4 shrink-0 items-center justify-center">
        {event.status === "denied" ? (
          <Ban className="size-3.5 text-muted-foreground" aria-hidden />
        ) : (
          <span
            className={cn(
              "size-2 rounded-full",
              dotClassByStatus[event.status]
            )}
            aria-hidden
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">
          {event.stage}
          {event.status === "denied" ? (
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              denied
            </span>
          ) : null}
        </p>
        {event.detail ? (
          <p className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
            {event.detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}
