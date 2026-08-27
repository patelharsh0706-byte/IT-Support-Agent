import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"

import { ActivityEventRow } from "@/components/shared/activity-event-row"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ActivityEvent, ActivityTerminalState } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

const terminalStyleByKind = {
  confirm: {
    icon: CheckCircle2,
    className: "bg-state-success/10 text-state-success",
  },
  clarify: {
    icon: HelpCircle,
    className: "bg-state-pending/10 text-state-pending",
  },
  escalate: {
    icon: AlertTriangle,
    className: "bg-state-error/10 text-state-error",
  },
} as const

interface ActivityPanelProps {
  events: ActivityEvent[]
  terminalState?: ActivityTerminalState
  emptyMessage?: string
  className?: string
}

/**
 * Scrollable activity stream backing the admin case-detail tool-call log.
 * Renders one row per event, plus a distinct closing row for the terminal
 * state when present. CSR-facing only — the customer dashboard shows plain
 * ticket status instead (`components/editor/ticket-status-panel.tsx`).
 */
export function ActivityPanel({
  events,
  terminalState,
  emptyMessage = "No activity yet.",
  className,
}: ActivityPanelProps) {
  return (
    <ScrollArea className={cn("min-h-0 w-full min-w-0 flex-1", className)}>
      <div className="flex min-w-0 flex-col divide-y divide-border px-4">
        {events.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          events.map((event) => (
            <ActivityEventRow key={event.id} event={event} />
          ))
        )}
      </div>

      {terminalState ? (
        <div className="px-4 pt-2 pb-4">
          {(() => {
            const { icon: Icon, className: styleClassName } =
              terminalStyleByKind[terminalState.kind]
            return (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium",
                  styleClassName
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{terminalState.message}</span>
              </div>
            )
          })()}
        </div>
      ) : null}
    </ScrollArea>
  )
}
