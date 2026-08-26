import { ArrowUpCircle } from "lucide-react"

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

interface EscalationMarkerProps {
  /** Who escalated, phrased for the reader — the CSR console names the
   *  customer, the customer's own dashboard says "You". */
  title: string
  /**
   * The customer's stated reason — always present. A thread only carries
   * an escalation event when a customer escalated and said why; a bare
   * `escalated_at` (the clock basis, which seeding and severity bumps
   * also set) is not an event and never reaches this component.
   */
  reason: string
  timestamp: string
}

/**
 * An escalation is a case event, not something anyone said in the
 * conversation — so it renders as a centered marker on both the CSR
 * console and the customer dashboard, never as a chat bubble or a
 * message row. Shared so the two surfaces cannot drift apart on what an
 * escalation looks like.
 */
export function EscalationMarker({ title, reason, timestamp }: EscalationMarkerProps) {
  return (
    <div className="flex justify-center py-2">
      <div className="flex max-w-md items-start gap-2 rounded-lg border border-state-error/20 bg-state-error/10 px-3 py-2 text-[13px] text-state-error">
        <ArrowUpCircle className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-0.5">
            <span className="opacity-80">Reason: </span>
            {reason}
          </p>
          <p className="mt-0.5 text-[11px] opacity-80">
            {timeFormatter.format(new Date(timestamp))}
          </p>
        </div>
      </div>
    </div>
  )
}
