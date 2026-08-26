// Mock data shapes for the customer and admin dashboards.
// Field names mirror the real schema described in
// `context/architecture.md` and `docs/plans/2026-08-22-001-feat-social-grievance-intake-plan.md`
// so swapping in real data later is a drop-in, not a rewrite.

export type ActivityStatus = "running" | "ok" | "failed" | "denied"

export interface ActivityEvent {
  id: string
  /** e.g. "Intent classification", "Card unblock" */
  stage: string
  status: ActivityStatus
  /** Mono-rendered: tool name / params / result. Never prose. */
  detail?: string
  timestamp: string
}

export type ActivityTerminalState =
  | { kind: "confirm"; message: string }
  | { kind: "clarify"; message: string }
  | { kind: "escalate"; message: string }

export type Intent =
  | "card_unblock_activation"
  | "unrecognized_transaction"
  | "update_contact_info"

export type Priority = "low" | "medium" | "high"
export type TicketStatus = "open" | "in_progress" | "resolved" | "escalated"

export interface Ticket {
  id: string
  /** Null until `lib/agent/classify.ts` (not built yet) classifies it. */
  intent: Intent | null
  title: string
  priority: Priority
  status: TicketStatus
  createdAt: string
  updatedAt: string
  /** Mirrors `service_request.escalated_at`. Null until escalated. */
  escalatedAt?: string | null
  /** Customer's stated reason, captured when they escalate to an admin. Mirrors `service_request.escalation_reason`. */
  escalationReason?: string | null
}

/** "csr" is a human reply; "agent" is reserved for the future AI pipeline (`lib/agent/`, not built yet). */
export type MessageAuthorRole = "customer" | "agent" | "csr"

export interface ChatMessage {
  id: string
  ticketId: string
  authorRole: MessageAuthorRole
  authorName: string
  content: string
  timestamp: string
  /** Agent-activity stream attached to this turn, if any. */
  activityEvents?: ActivityEvent[]
}

export type CaseChannel = "amex_support" | "social" | "website_chatbot"
export type Severity = "low" | "medium" | "high"
export type CustomerStatus = "active" | "closed" | "unknown"

export interface SeverityChange {
  id: string
  from: Severity | null
  to: Severity
  changedAt: string
  reason?: string
}

export interface DedupePost {
  id: string
  permalink: string
  excerpt: string
  postedAt: string
}

/** A real, persisted `chat_messages` row — see `lib/mock/case-thread.ts`'s `buildCaseThread()`. */
export interface RealChatMessage {
  id: string
  authorRole: MessageAuthorRole
  authorName: string
  content: string
  timestamp: string
  isPrivateNote: boolean
}

export type ReplyState = "needs_reply" | "draft_ready" | "replied" | "escalated"

export interface GrievanceCase {
  id: string
  channel: CaseChannel
  /** Display identity for the list row and conversation header. Never authentication. */
  customerName: string
  /** Social handle / chat alias, when the channel has one. */
  customerHandle?: string
  summary: string
  currentSeverity: Severity
  /** Drives the "changed" indicator next to the severity badge in the queue. */
  severityChangedRecently: boolean
  /** Case-age clock basis: always running. */
  createdAt: string
  /** Time-in-escalation clock basis: null until escalated, then never reset. */
  escalatedAt: string | null
  /** Customer's stated reason, captured when they escalate. Mirrors `service_request.escalation_reason`. */
  escalationReason: string | null
  customerStatus: CustomerStatus
  /** Social/chat identity is a hint, never authentication — soft link only. */
  customerVerified: boolean
  contactedByCsrName: string | null
  replyState: ReplyState
  originalPostUrl?: string
  classification?: { intent: Intent; confidence: number }
  dedupePosts: DedupePost[]
  severityHistory: SeverityChange[]
  toolCallLog: ActivityEvent[]
  aiDraftReply?: string
  /** Real per-case thread, when a chat session exists. Empty until a first message. */
  realChatMessages: RealChatMessage[]
}

export interface DashboardMetrics {
  openBySeverity: Record<Severity, number>
  oldestUnansweredCaseId: string | null
  oldestUnansweredAgeHours: number | null
  escalationsPastThreshold: number
  /**
   * Headline metric: customers who closed their account while a grievance
   * sat open. `null` when not computable — the schema has no closure
   * timestamp/status history to derive this from yet (see
   * `context/progress-tracker.md`, Open Questions). Render as an explicit
   * "not yet available" state, never as `0`.
   */
  closedAccountOpenGrievanceCount: number | null
}
