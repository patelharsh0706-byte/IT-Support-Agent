import type { GrievanceCase, RealChatMessage } from "./types"

export type ThreadAuthor = "customer" | "csr"

/**
 * "message" is something a person actually said. "escalation" is a case
 * event that happened *to* the thread — rendered as a marker, never as a
 * reply, because an escalation is not a remark the customer made in the
 * conversation.
 */
export type CaseThreadEntryKind = "message" | "escalation"

export interface CaseThreadMessage {
  id: string
  caseId: string
  kind: CaseThreadEntryKind
  author: ThreadAuthor
  authorName: string
  body: string
  timestamp: string
  /** Source link for social posts; absent for synthesized and outbound messages. */
  permalink?: string
  /** Internal note — never sent to the customer. */
  isPrivateNote?: boolean
}

/**
 * A persisted `chat_messages.author_role` narrowed to the two sides the
 * thread renders. "agent" (the future AI pipeline, `lib/agent/`) renders
 * outbound like a CSR — from the customer's side of the glass both are
 * "someone from Amex replied"; the row keeps the finer distinction.
 */
function threadAuthor(authorRole: RealChatMessage["authorRole"]): ThreadAuthor {
  return authorRole === "customer" ? "customer" : "csr"
}

/**
 * Builds a case's thread: its social-origin posts (when the case came in
 * over a social channel), every persisted `chat_messages` row, and the
 * escalation event if the case has one — merged in timestamp order.
 *
 * Pure and stable (no `Date.now()`), so it's safe to call from a server
 * component and hydrates identically on the client.
 */
export function buildCaseThread(grievanceCase: GrievanceCase): CaseThreadMessage[] {
  const originPosts: CaseThreadMessage[] = grievanceCase.dedupePosts.map((post) => ({
    id: post.id,
    caseId: grievanceCase.id,
    kind: "message" as const,
    author: "customer" as const,
    authorName: grievanceCase.customerName,
    body: post.excerpt,
    timestamp: post.postedAt,
    permalink: post.permalink,
  }))

  const persisted: CaseThreadMessage[] = grievanceCase.realChatMessages.map((message) => ({
    id: message.id,
    caseId: grievanceCase.id,
    kind: "message" as const,
    author: threadAuthor(message.authorRole),
    authorName: message.authorName,
    body: message.content,
    timestamp: message.timestamp,
    isPrivateNote: message.isPrivateNote,
  }))

  // Derived from the `service_request` row, never stored as a message —
  // see `escalateServiceRequest()`.
  //
  // Gated on the stated reason, not on `escalatedAt`: the two mean
  // different things. `escalatedAt` is the time-in-escalation clock
  // basis, set by any path that puts a case into escalation (seeding,
  // intake, a severity bump); `escalationReason` is written only when a
  // customer actually escalated and said why. Keying the marker off the
  // timestamp invented an escalation event for cases where none
  // happened, and attributed it to a customer who never escalated.
  const statedReason = grievanceCase.escalationReason?.trim()
  const escalation: CaseThreadMessage[] =
    statedReason && grievanceCase.escalatedAt
      ? [
          {
            id: `${grievanceCase.id}_escalation`,
            caseId: grievanceCase.id,
            kind: "escalation",
            author: "customer",
            authorName: grievanceCase.customerName,
            body: statedReason,
            timestamp: grievanceCase.escalatedAt,
          },
        ]
      : []

  // No message from any source (a case raised through a channel that
  // leaves no post and that nobody has written to yet) — a thread must
  // never be empty, so synthesize one opening message from the summary.
  // The escalation marker is an event, not a message, so it doesn't count
  // as the thread having something to show.
  const seed: CaseThreadMessage[] =
    originPosts.length === 0 && persisted.length === 0
      ? [
          {
            id: `${grievanceCase.id}_seed`,
            caseId: grievanceCase.id,
            kind: "message",
            author: "customer",
            authorName: grievanceCase.customerName,
            body: grievanceCase.summary,
            timestamp: grievanceCase.createdAt,
          },
        ]
      : []

  // Sorted by timestamp, with the id as a tiebreaker so two entries
  // written in the same millisecond keep a stable order between renders.
  return [...seed, ...originPosts, ...persisted, ...escalation].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)
  )
}

/**
 * Latest activity across every source on the case — the thread, tool
 * calls, and severity changes — not just the last message. A severity
 * change or tool call can happen after the last customer post.
 */
export function caseLastActivityAt(grievanceCase: GrievanceCase): string {
  const timestamps = [
    ...buildCaseThread(grievanceCase).map((m) => m.timestamp),
    ...grievanceCase.toolCallLog.map((e) => e.timestamp),
    ...grievanceCase.severityHistory.map((s) => s.changedAt),
  ]
  if (timestamps.length === 0) return grievanceCase.createdAt
  return timestamps.reduce((latest, ts) => (ts > latest ? ts : latest))
}

/**
 * The one-line form of an escalation event, for previews and summaries.
 * The reason is always present — see `buildCaseThread()`, which only
 * emits an escalation entry when the customer stated one.
 */
export function escalationPreviewText(reason: string): string {
  return `Escalated — ${reason}`
}

/**
 * Preview line for the conversation list. Private notes are skipped — the
 * preview should read as the conversation, not as the team's internal
 * commentary on it. An escalation is labelled rather than quoted, so the
 * list never reads the reason as if the customer just said it.
 */
export function casePreviewText(grievanceCase: GrievanceCase): string {
  const thread = buildCaseThread(grievanceCase).filter((m) => !m.isPrivateNote)
  const latest = thread[thread.length - 1]
  if (!latest) return grievanceCase.summary
  return latest.kind === "escalation" ? escalationPreviewText(latest.body) : latest.body
}
