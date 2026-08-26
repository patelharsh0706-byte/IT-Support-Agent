import type { ChatMessage, Ticket } from "./types"

/**
 * The customer-side counterpart to `lib/mock/case-thread.ts`'s
 * `CaseThreadEntryKind`: "message" is something a person said, "escalation"
 * is a case event that happened *to* the thread.
 */
export type TicketThreadEntry =
  | { kind: "message"; id: string; timestamp: string; message: ChatMessage }
  | { kind: "escalation"; id: string; timestamp: string; reason: string }

/**
 * Merges a ticket's persisted chat messages with its escalation event,
 * in timestamp order.
 *
 * The escalation is derived from the ticket's own `escalatedAt` /
 * `escalationReason` — the same single source of truth the CSR console
 * reads — and is deliberately not stored as a chat message: stored as a
 * message it can only render as one, which made a customer's escalation
 * read as an ordinary remark on both surfaces.
 *
 * Pure and stable (no `Date.now()`), so it renders identically on the
 * server and the client.
 */
export function buildTicketThread(
  ticket: Ticket | null,
  messages: ChatMessage[]
): TicketThreadEntry[] {
  const entries: TicketThreadEntry[] = messages.map((message) => ({
    kind: "message",
    id: message.id,
    timestamp: message.timestamp,
    message,
  }))

  // Gated on the stated reason, not on `escalatedAt` — same rule as
  // `buildCaseThread()`, for the same reason: `escalatedAt` is the
  // time-in-escalation clock basis and gets set by paths no customer
  // initiated, while a reason exists only when one actually escalated.
  const statedReason = ticket?.escalationReason?.trim()
  if (ticket?.escalatedAt && statedReason) {
    entries.push({
      kind: "escalation",
      id: `${ticket.id}_escalation`,
      timestamp: ticket.escalatedAt,
      reason: statedReason,
    })
  }

  // Sorted by timestamp, with the id as a tiebreaker so two entries
  // recorded in the same millisecond keep a stable order between renders.
  return entries.sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)
  )
}
