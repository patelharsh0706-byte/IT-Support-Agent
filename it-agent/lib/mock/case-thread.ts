import type { GrievanceCase } from "./types"

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
 * Builds a case's message thread from its existing fields. This is the
 * single swap point for real message data: when a real thread exists,
 * replace this function's body and nothing else in the app needs to change.
 *
 * Pure and stable (no `Date.now()`), so it's safe to call from a server
 * component and hydrates identically on the client.
 */
export function buildCaseThread(grievanceCase: GrievanceCase): CaseThreadMessage[] {
  if (grievanceCase.dedupePosts.length > 0) {
    return [...grievanceCase.dedupePosts]
      .sort((a, b) => a.postedAt.localeCompare(b.postedAt))
      .map((post) => ({
        id: post.id,
        caseId: grievanceCase.id,
        author: "customer" as const,
        authorName: grievanceCase.customerName,
        body: post.excerpt,
        timestamp: post.postedAt,
        permalink: post.permalink,
      }))
  }

  // No dedupe posts (today: amex_support / website_chatbot cases) — a
  // thread must never be empty, so synthesize one opening message from
  // the case summary.
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

export function casePreviewText(grievanceCase: GrievanceCase): string {
  const thread = buildCaseThread(grievanceCase)
  return thread[thread.length - 1]?.body ?? grievanceCase.summary
}
