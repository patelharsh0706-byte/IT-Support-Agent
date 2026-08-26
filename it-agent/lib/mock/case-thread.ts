import type { GrievanceCase, RealChatMessage } from "./types"

export type ThreadAuthor = "customer" | "csr"

export interface CaseThreadMessage {
  id: string
  caseId: string
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
 * Builds a case's message thread: its social-origin posts (when the case
 * came in over a social channel) followed by every persisted
 * `chat_messages` row, merged in timestamp order.
 *
 * Pure and stable (no `Date.now()`), so it's safe to call from a server
 * component and hydrates identically on the client.
 */
export function buildCaseThread(grievanceCase: GrievanceCase): CaseThreadMessage[] {
  const originPosts: CaseThreadMessage[] = grievanceCase.dedupePosts.map((post) => ({
    id: post.id,
    caseId: grievanceCase.id,
    author: "customer" as const,
    authorName: grievanceCase.customerName,
    body: post.excerpt,
    timestamp: post.postedAt,
    permalink: post.permalink,
  }))

  const persisted: CaseThreadMessage[] = grievanceCase.realChatMessages.map((message) => ({
    id: message.id,
    caseId: grievanceCase.id,
    author: threadAuthor(message.authorRole),
    authorName: message.authorName,
    body: message.content,
    timestamp: message.timestamp,
    isPrivateNote: message.isPrivateNote,
  }))

  // Neither source has anything (a case raised through a channel that
  // leaves no post and that nobody has written to yet) — a thread must
  // never be empty, so synthesize one opening message from the summary.
  if (originPosts.length === 0 && persisted.length === 0) {
    return [
      {
        id: `${grievanceCase.id}_seed`,
        caseId: grievanceCase.id,
        author: "customer",
        authorName: grievanceCase.customerName,
        body: grievanceCase.summary,
        timestamp: grievanceCase.createdAt,
      },
    ]
  }

  // Sorted by timestamp, with the id as a tiebreaker so two messages
  // written in the same millisecond keep a stable order between renders.
  return [...originPosts, ...persisted].sort(
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
 * Preview line for the conversation list. Private notes are skipped — the
 * preview should read as the conversation, not as the team's internal
 * commentary on it.
 */
export function casePreviewText(grievanceCase: GrievanceCase): string {
  const thread = buildCaseThread(grievanceCase).filter((m) => !m.isPrivateNote)
  return thread[thread.length - 1]?.body ?? grievanceCase.summary
}
