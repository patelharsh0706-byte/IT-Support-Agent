import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"

import { ActivityEventRow } from "@/components/shared/activity-event-row"
import { ActivityTimestamp } from "@/components/shared/activity-timestamp"
import { ScrollArea } from "@/components/ui/scroll-area"
import { groupActivityIntoTurns, type TurnOutcome } from "@/lib/mock/activity-turns"
import type { ActivityEvent, ActivityTerminalState } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

/** Reuses the three state tokens; no new colour values (`ui-context.md`). */
const outcomeStyle: Record<TurnOutcome, { label: string; className: string }> = {
  resolved: { label: "Resolved", className: "bg-state-success/10 text-state-success" },
  escalated: { label: "Escalated", className: "bg-state-error/10 text-state-error" },
  failed: { label: "Failed", className: "bg-state-error/10 text-state-error" },
  running: { label: "In progress", className: "bg-state-pending/10 text-state-pending" },
}

function durationLabel(startedAt: string, endedAt: string): string | null {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

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
      <div className="flex min-w-0 flex-col gap-3 px-4 py-3">
        {events.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          // One box per turn, newest first. A flat list made three separate
          // conversations look like one run of eighteen steps.
          groupActivityIntoTurns(events).map((turn) => {
            const style = outcomeStyle[turn.outcome]
            const duration = durationLabel(turn.startedAt, turn.endedAt)
            return (
              <section
                key={turn.id}
                className="min-w-0 rounded-xl border border-border bg-surface"
                aria-label={`Agent turn, ${style.label}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <ActivityTimestamp
                    iso={turn.startedAt}
                    className="text-[12px] font-medium text-foreground"
                  />
                  <span className="flex items-center gap-2">
                    {duration ? (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {duration}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-[11px] font-medium",
                        style.className,
                      )}
                    >
                      {style.label}
                    </span>
                  </span>
                </header>
                <div className="flex min-w-0 flex-col divide-y divide-border px-3">
                  {turn.events.map((event) => (
                    <ActivityEventRow key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )
          })
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
