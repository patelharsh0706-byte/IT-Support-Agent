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
  intent: Intent
  title: string
  priority: Priority
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

export type MessageAuthorRole = "customer" | "agent"

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
}

export interface DashboardMetrics {
  openBySeverity: Record<Severity, number>
  oldestUnansweredCaseId: string | null
  oldestUnansweredAgeHours: number | null
  escalationsPastThreshold: number
  /** Headline metric: customers who closed their account while a grievance sat open. */
  closedAccountOpenGrievanceCount: number
}
