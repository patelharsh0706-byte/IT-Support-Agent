import { PriorityBadge } from "@/components/shared/priority-badge"
import {
  TicketStatusBadge,
  ticketStatusLabel,
} from "@/components/shared/ticket-status-badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { intentLabelFor } from "@/lib/mock/intent-labels"
import type { Ticket, TicketStatus } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

// Two separate formatters joined by a fixed separator — see the same note in
// `components/admin/severity-history.tsx`. A combined date+time formatter
// causes an SSR hydration mismatch when Node's and the browser's ICU data
// disagree on the connector text.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

function formatStamp(iso: string) {
  const date = new Date(iso)
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
}

const dotClassByStatus: Record<TicketStatus, string> = {
  open: "bg-state-pending",
  in_progress: "bg-primary",
  escalated: "bg-state-error",
  resolved: "bg-state-success",
}

interface TimelineStep {
  status: TicketStatus
  reached: boolean
  at: string | null
}

/**
 * The lifecycle a customer sees: raised, worked on, optionally escalated to a
 * human, resolved. Reaching a later status implies the earlier ones, so the
 * track is derived from the current status rather than stored per step.
 */
function buildTimeline(ticket: Ticket): TimelineStep[] {
  const { status, createdAt, updatedAt, escalatedAt } = ticket

  const inProgressReached = status !== "open"
  const escalatedReached = status === "escalated"
  const resolvedReached = status === "resolved"

  return [
    { status: "open", reached: true, at: createdAt },
    // Only the current step carries `updatedAt`. An earlier step that has been
    // passed is marked reached but left unstamped rather than borrowing a
    // timestamp that would assert a transition time we do not store.
    {
      status: "in_progress",
      reached: inProgressReached,
      at: status === "in_progress" ? updatedAt : null,
    },
    {
      status: "escalated",
      reached: escalatedReached,
      at: escalatedReached ? (escalatedAt ?? updatedAt) : null,
    },
    {
      status: "resolved",
      reached: resolvedReached,
      at: resolvedReached ? updatedAt : null,
    },
  ]
}

function StatusTimeline({ ticket }: { ticket: Ticket }) {
  const steps = buildTimeline(ticket)

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.status} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                step.reached ? dotClassByStatus[step.status] : "bg-border"
              )}
            />
            {index < steps.length - 1 ? (
              <span aria-hidden className="w-px flex-1 bg-border" />
            ) : null}
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-1 items-baseline justify-between gap-3",
              index < steps.length - 1 && "pb-5"
            )}
          >
            <span
              className={cn(
                "text-[15px]",
                step.reached
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {ticketStatusLabel[step.status]}
            </span>
            <span className="shrink-0 text-[13px] text-muted-foreground">
              {step.at ? formatStamp(step.at) : "—"}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

interface TicketStatusPanelProps {
  ticket: Ticket | null
  onEscalate: () => void
  className?: string
}

/**
 * Right-hand panel of the customer dashboard: where this ticket stands and
 * the one action the customer can take on it. Tool-call level detail stays in
 * the CSR console — this panel is plain language only.
 */
export function TicketStatusPanel({
  ticket,
  onEscalate,
  className,
}: TicketStatusPanelProps) {
  const canEscalate =
    ticket !== null &&
    ticket.status !== "escalated" &&
    ticket.status !== "resolved"

  return (
    <aside
      aria-label="Ticket status"
      className={cn(
        "flex w-full max-w-120 shrink-0 flex-col border-l border-border bg-surface",
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <h2 className="text-[15px] font-medium text-foreground">
          Ticket Status
        </h2>
      </div>

      {ticket ? (
        <>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-6 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <TicketStatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {intentLabelFor(ticket.intent)}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-[13px] font-medium text-muted-foreground">
                  Progress
                </h3>
                <StatusTimeline ticket={ticket} />
              </div>

              {ticket.escalationReason ? (
                <div className="flex flex-col gap-1 rounded-xl bg-subtle p-3">
                  <p className="text-[13px] font-medium text-foreground">
                    {ticket.escalatedAt
                      ? `You escalated this on ${formatStamp(ticket.escalatedAt)}`
                      : "You escalated this ticket"}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {ticket.escalationReason}
                  </p>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
            {canEscalate ? (
              <p className="text-[13px] text-muted-foreground">
                Card, transaction, and account requests are handled by the
                servicing agent — just describe it in the chat. Escalate only
                if it is urgent or the agent could not resolve it.
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onEscalate}
              disabled={!canEscalate}
            >
              Escalate to admin
            </Button>
            {canEscalate ? null : (
              <p className="text-center text-[13px] text-muted-foreground">
                {ticket.status === "escalated"
                  ? "An admin is reviewing this ticket."
                  : "This ticket is resolved."}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-4 py-10 text-center text-[13px] text-muted-foreground">
          Select a ticket to see its status.
        </div>
      )}
    </aside>
  )
}
