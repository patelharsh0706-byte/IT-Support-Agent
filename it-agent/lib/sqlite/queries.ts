import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm"
import { currentUser } from "@clerk/nextjs/server"
import { cache } from "react"
import { db } from "./client"
import {
  agentActions,
  chatMessages,
  chatSessions,
  customers,
  cards,
  serviceRequests,
  severityChanges,
  transactions,
  socialPosts,
  tweetMentions,
  tweetReplies,
} from "./schema"
import type { DashboardMetrics, GrievanceCase, Intent, MessageAuthorRole } from "@/lib/mock/types"

// Resolves `customers.clerk_user_id` to the internal customer row, per
// `feature-specs/06-project-api.md`'s Rules section and
// `context/progress-tracker.md`'s U2 follow-up ("Next step is linking the
// two"). No seeded customer has `clerk_user_id` set, so a first-time
// sign-in provisions its own row from the Clerk profile rather than
// failing closed.
export async function resolveCustomer(clerkUserId: string) {
  const existing = await db.query.customers.findFirst({
    where: eq(customers.clerkUserId, clerkUserId),
  })
  if (existing) return existing

  const clerkProfile = await currentUser()
  const email = clerkProfile?.primaryEmailAddress?.emailAddress ?? `${clerkUserId}@unknown`
  const name = clerkProfile?.fullName ?? email

  // Conflict-safe: if a concurrent request already provisioned this
  // clerk_user_id (see the unique index in schema.ts), this insert is a
  // no-op and returns no row rather than throwing or duplicating.
  const [created] = await db
    .insert(customers)
    .values({
      id: `cust_${crypto.randomUUID()}`,
      clerkUserId,
      name,
      email,
      status: "active",
    })
    .onConflictDoNothing({ target: customers.clerkUserId })
    .returning()
  if (created) return created

  const winner = await db.query.customers.findFirst({
    where: eq(customers.clerkUserId, clerkUserId),
  })
  if (!winner) {
    throw new Error(`resolveCustomer: no customer row for ${clerkUserId} after conflict`)
  }
  return winner
}

export async function listServiceRequestsForCustomer(customerId: string) {
  return db.query.serviceRequests.findMany({
    where: eq(serviceRequests.customerId, customerId),
    orderBy: desc(serviceRequests.createdAt),
  })
}

export async function createServiceRequest(customerId: string, title: string) {
  const now = new Date().toISOString()
  const [created] = await db
    .insert(serviceRequests)
    .values({
      id: `tkt_${crypto.randomUUID()}`,
      customerId,
      channel: "amex_support",
      intent: null,
      title,
      priority: "medium",
      status: "open",
      currentSeverity: "low",
      customerVerified: true,
      replyState: "needs_reply",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return created
}

export async function getServiceRequestById(id: string) {
  return db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, id),
  })
}

export async function renameServiceRequest(id: string, title: string) {
  const [updated] = await db
    .update(serviceRequests)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(serviceRequests.id, id))
    .returning()
  return updated
}

export async function deleteServiceRequest(id: string, customerId: string) {
  await db
    .delete(serviceRequests)
    .where(and(eq(serviceRequests.id, id), eq(serviceRequests.customerId, customerId)))
}

// --- Chat messages (customer <-> CSR), shared by both dashboards ---

// A service request has at most one chat session by construction — every
// caller reaches this through `insertChatMessage`, a single serialized path
// per request. Two near-simultaneous first messages on the same ticket
// could in theory double-insert a session (no unique index enforces this);
// acceptable at this data volume for a prototype, not worth a migration.
export async function getOrCreateChatSessionForServiceRequest(
  serviceRequestId: string,
  customerId: string,
) {
  const existing = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.serviceRequestId, serviceRequestId),
  })
  if (existing) return existing

  const [created] = await db
    .insert(chatSessions)
    .values({
      id: `sess_${crypto.randomUUID()}`,
      customerId,
      serviceRequestId,
    })
    .returning()
  return created
}

export async function listChatMessagesForServiceRequest(serviceRequestId: string) {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.serviceRequestId, serviceRequestId),
  })
  if (!session) return []

  return db.query.chatMessages.findMany({
    where: eq(chatMessages.chatSessionId, session.id),
    orderBy: asc(chatMessages.timestamp),
  })
}

export async function insertChatMessage(params: {
  serviceRequestId: string
  customerId: string
  authorRole: MessageAuthorRole
  authorName: string
  content: string
  isPrivateNote?: boolean
}) {
  const session = await getOrCreateChatSessionForServiceRequest(
    params.serviceRequestId,
    params.customerId,
  )
  const [created] = await db
    .insert(chatMessages)
    .values({
      id: `msg_${crypto.randomUUID()}`,
      chatSessionId: session.id,
      authorRole: params.authorRole,
      authorName: params.authorName,
      content: params.content,
      timestamp: new Date().toISOString(),
      isPrivateNote: params.isPrivateNote ?? false,
    })
    .returning()
  return created
}

/** On a non-private CSR send, mirrors the reply-state side effect the old local-only UI used to fake. */
export async function markServiceRequestReplied(serviceRequestId: string, csrName: string) {
  await db
    .update(serviceRequests)
    .set({ replyState: "replied", contactedByCsrName: csrName, updatedAt: new Date().toISOString() })
    .where(eq(serviceRequests.id, serviceRequestId))
}

/**
 * Atomic escalate: bumps status/priority/severity and records the reason on
 * the `service_request` row itself.
 *
 * The reason is deliberately *not* written into `chat_messages`. An
 * escalation is a case event, not something the customer said in the
 * conversation — stored as a message it renders as an ordinary reply and
 * the "this case was escalated, here's why" signal disappears into the
 * thread. `buildCaseThread()` synthesizes the event into the thread from
 * `escalated_at` + `escalation_reason` instead, keeping one source of
 * truth that can't drift from the row.
 */
export async function escalateServiceRequest(serviceRequestId: string, reason: string) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.serviceRequests.findFirst({
      where: eq(serviceRequests.id, serviceRequestId),
    })
    if (!existing) {
      throw new Error(`escalateServiceRequest: no service_request ${serviceRequestId}`)
    }

    const now = new Date().toISOString()
    const [updated] = await tx
      .update(serviceRequests)
      .set({
        status: "escalated",
        priority: "high",
        currentSeverity: "high",
        
        escalationReason: reason,
        updatedAt: now,
      })
      .where(eq(serviceRequests.id, serviceRequestId))
      .returning()

    await tx.insert(severityChanges).values({
      id: `sev_${crypto.randomUUID()}`,
      serviceRequestId,
      fromSeverity: existing.currentSeverity,
      toSeverity: "high",
      changedAt: now,
      reason,
    })

    return updated
  })
}

// --- Admin/CSR console reads (06-project-api and 05-sqlite built the write
// side + customer-scoped reads above; these are the CSR-facing reads added
// in 07-wire-ui-api) ---

// A case row "changed recently" if its latest severity change happened
// within this window. Not defined anywhere in the specs — a demo-reasonable
// placeholder, documented here and in `context/progress-tracker.md` rather
// than left as a silent guess.
const SEVERITY_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000
// Same placeholder-threshold treatment for "an escalation has sat too long."
const ESCALATION_STALE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Every `service_request` row (all channels — the mock model's split
 * between `Ticket` and `GrievanceCase` fixtures doesn't exist in the real
 * schema; both live in one table), assembled into the `GrievanceCase` shape
 * the admin console already renders against. No `relations()` are declared
 * on the schema, so this fetches each related table separately and joins in
 * JS rather than using Drizzle's nested `with:` query API — fine at this
 * data volume (a handful of rows), not a pattern to scale past a prototype.
 */
export const listGrievanceCases = cache(async (): Promise<GrievanceCase[]> => {
  const requests = await db
    .select()
    .from(serviceRequests)
    .orderBy(desc(serviceRequests.createdAt))

  if (requests.length === 0) return []

  const requestIds = requests.map((r) => r.id)
  const customerIds = [...new Set(requests.map((r) => r.customerId).filter((id) => id !== null))]

  const [
    relatedCustomers,
    allSocialPosts,
    allSeverityChanges,
    allAgentActions,
    relatedChatSessions,
  ] = await Promise.all([
    customerIds.length > 0
      ? db.select().from(customers).where(inArray(customers.id, customerIds))
      : Promise.resolve([]),
    db.select().from(socialPosts).where(inArray(socialPosts.serviceRequestId, requestIds)),
    db.select().from(severityChanges).where(inArray(severityChanges.serviceRequestId, requestIds)),
    db.select().from(agentActions).where(inArray(agentActions.serviceRequestId, requestIds)),
    db.select().from(chatSessions).where(inArray(chatSessions.serviceRequestId, requestIds)),
  ])

  const sessionIdToRequestId = new Map(relatedChatSessions.map((s) => [s.id, s.serviceRequestId]))
  const sessionIds = relatedChatSessions.map((s) => s.id)
  const allChatMessages =
    sessionIds.length > 0
      ? await db.select().from(chatMessages).where(inArray(chatMessages.chatSessionId, sessionIds))
      : []

  const customerById = new Map(relatedCustomers.map((c) => [c.id, c]))
  const socialPostsByRequest = new Map<string, typeof allSocialPosts>()
  for (const post of allSocialPosts) {
    const list = socialPostsByRequest.get(post.serviceRequestId) ?? []
    list.push(post)
    socialPostsByRequest.set(post.serviceRequestId, list)
  }
  const severityChangesByRequest = new Map<string, typeof allSeverityChanges>()
  for (const change of allSeverityChanges) {
    const list = severityChangesByRequest.get(change.serviceRequestId) ?? []
    list.push(change)
    severityChangesByRequest.set(change.serviceRequestId, list)
  }
  const agentActionsByRequest = new Map<string, typeof allAgentActions>()
  for (const action of allAgentActions) {
    if (!action.serviceRequestId) continue
    const list = agentActionsByRequest.get(action.serviceRequestId) ?? []
    list.push(action)
    agentActionsByRequest.set(action.serviceRequestId, list)
  }
  const chatMessagesByRequest = new Map<string, typeof allChatMessages>()
  for (const message of allChatMessages) {
    const requestId = sessionIdToRequestId.get(message.chatSessionId)
    if (!requestId) continue
    const list = chatMessagesByRequest.get(requestId) ?? []
    list.push(message)
    chatMessagesByRequest.set(requestId, list)
  }

  const now = Date.now()

  return requests.map((row) => {
    const customer = row.customerId ? customerById.get(row.customerId) : undefined
    const severityHistory = (severityChangesByRequest.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    const latestSeverityChangeAt = severityHistory.at(-1)?.changedAt
    const severityChangedRecently = latestSeverityChangeAt
      ? now - new Date(latestSeverityChangeAt).getTime() < SEVERITY_RECENT_WINDOW_MS
      : false

    return {
      id: row.id,
      channel: row.channel,
      customerName: customer?.name ?? "Unknown customer",
      customerHandle: undefined,
      summary: row.title,
      currentSeverity: row.currentSeverity,
      severityChangedRecently,
      createdAt: row.createdAt,
      escalatedAt: row.escalatedAt,
      escalationReason: row.escalationReason,
      customerStatus: customer?.status ?? "unknown",
      customerVerified: row.customerVerified,
      contactedByCsrName: row.contactedByCsrName,
      replyState: row.replyState,
      originalPostUrl: row.originalPostUrl ?? undefined,
      classification: row.classificationIntent
        ? { intent: row.classificationIntent as Intent, confidence: row.classificationConfidence ?? 0 }
        : undefined,
      dedupePosts: (socialPostsByRequest.get(row.id) ?? []).map((p) => ({
        id: p.id,
        permalink: p.permalink,
        excerpt: p.excerpt,
        postedAt: p.postedAt,
      })),
      severityHistory: severityHistory.map((s) => ({
        id: s.id,
        from: s.fromSeverity,
        to: s.toSeverity,
        changedAt: s.changedAt,
        reason: s.reason ?? undefined,
      })),
      toolCallLog: (agentActionsByRequest.get(row.id) ?? []).map((a) => ({
        id: a.id,
        stage: a.stage,
        status: a.status,
        detail: a.detail ?? undefined,
        timestamp: a.timestamp,
      })),
      aiDraftReply: row.aiDraftReply ?? undefined,
      realChatMessages: (chatMessagesByRequest.get(row.id) ?? []).map((m) => ({
        id: m.id,
        authorRole: m.authorRole,
        authorName: m.authorName,
        content: m.content,
        timestamp: m.timestamp,
        isPrivateNote: m.isPrivateNote,
      })),
    }
  })
})

export async function getGrievanceCaseDetail(id: string): Promise<GrievanceCase | null> {
  const cases = await listGrievanceCases()
  return cases.find((c) => c.id === id) ?? null
}

/**
 * 3 of 4 dashboard metrics computed live; `closedAccountOpenGrievanceCount`
 * returns `null` — the schema has no closure timestamp or status history on
 * `customers`/`service_request` to derive it from (flagged in
 * `context/progress-tracker.md`'s Open Questions, not silently guessed).
 */
export async function computeDashboardMetrics(): Promise<DashboardMetrics> {
  const requests = await db.select().from(serviceRequests)
  const now = Date.now()

  const openBySeverity = { low: 0, medium: 0, high: 0 }
  for (const row of requests) {
    if (row.status !== "resolved") {
      openBySeverity[row.currentSeverity] += 1
    }
  }

  const unanswered = requests
    .filter((row) => row.replyState === "needs_reply")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const oldestUnanswered = unanswered[0] ?? null
  const oldestUnansweredAgeHours = oldestUnanswered
    ? (now - new Date(oldestUnanswered.createdAt).getTime()) / (60 * 60 * 1000)
    : null

  const escalationsPastThreshold = requests.filter(
    (row) =>
      row.escalatedAt !== null &&
      row.status !== "resolved" &&
      now - new Date(row.escalatedAt).getTime() > ESCALATION_STALE_WINDOW_MS,
  ).length

  return {
    openBySeverity,
    oldestUnansweredCaseId: oldestUnanswered?.id ?? null,
    oldestUnansweredAgeHours,
    escalationsPastThreshold,
    closedAccountOpenGrievanceCount: null,
  }
}

// --- Tweet fetch agent (09-tweet-fetch-agent) ---
//
// Every read below uses `db.select()` rather than the relational query API.
// `db.query.*` builds its column list from the schema snapshot taken when
// `drizzle()` was constructed, so a column added mid-session silently comes
// back `undefined` — the bug fixed in commit 2752f28. These tables are new,
// which is exactly when that bites.

/**
 * Inserts only mentions we have not seen, keyed on the platform's own id.
 * Returns what happened so the fetch route can report "12 fetched, 3 new" —
 * pressing Fetch twice must insert nothing the second time.
 */
export async function upsertTweetMentions(
  rows: (typeof tweetMentions.$inferInsert)[],
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 }

  const inserted = await db
    .insert(tweetMentions)
    .values(rows)
    // `tweet_id` is unique; a repeat fetch is a no-op rather than an error.
    .onConflictDoNothing({ target: tweetMentions.tweetId })
    .returning({ id: tweetMentions.id })

  return { inserted: inserted.length, skipped: rows.length - inserted.length }
}

/** Handles already stored, for the urgency rules' repeat-post signal. */
export async function listKnownTweetHandles(): Promise<Set<string>> {
  const rows = await db
    .select({ authorHandle: tweetMentions.authorHandle })
    .from(tweetMentions)
  return new Set(rows.map((r) => r.authorHandle))
}

export interface TweetFeedQuery {
  /** Hours back from now; undefined means no time bound. */
  windowHours?: number
  urgency?: "critical" | "high" | "normal"
  grievanceOnly?: boolean
  includeDismissed?: boolean
  unrepliedOnly?: boolean
}

const URGENCY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2 }

/**
 * The feed: mentions with their outbound attempts, urgency-first then newest.
 * Ordering is applied in JS because it is a rank over an enum, not a column
 * order — at this data volume that is cheaper than a CASE expression and far
 * easier to read.
 */
export async function listTweetMentions(query: TweetFeedQuery = {}) {
  const filters = []

  if (query.windowHours !== undefined) {
    const since = new Date(Date.now() - query.windowHours * 3_600_000).toISOString()
    filters.push(gte(tweetMentions.postedAt, since))
  }
  if (query.urgency) filters.push(eq(tweetMentions.urgency, query.urgency))
  if (query.grievanceOnly) filters.push(eq(tweetMentions.isGrievance, true))
  if (!query.includeDismissed) filters.push(isNull(tweetMentions.dismissedAt))

  const mentions = await db
    .select()
    .from(tweetMentions)
    .where(filters.length > 0 ? and(...filters) : undefined)

  const mentionIds = mentions.map((m) => m.id)
  const replies =
    mentionIds.length > 0
      ? await db
          .select()
          .from(tweetReplies)
          .where(inArray(tweetReplies.tweetMentionId, mentionIds))
      : []

  const repliesByMention = new Map<string, typeof replies>()
  for (const reply of replies) {
    const list = repliesByMention.get(reply.tweetMentionId) ?? []
    list.push(reply)
    repliesByMention.set(reply.tweetMentionId, list)
  }

  const assembled = mentions.map((mention) => ({
    ...mention,
    urgencyReasons: parseReasons(mention.urgencyReasons),
    replies: (repliesByMention.get(mention.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  }))

  const filtered = query.unrepliedOnly
    ? assembled.filter((m) => !m.replies.some((r) => r.status === "sent"))
    : assembled

  return filtered.sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      b.postedAt.localeCompare(a.postedAt) ||
      a.tweetId.localeCompare(b.tweetId),
  )
}

/** Stored as a JSON string; a malformed value degrades to no reasons rather than throwing. */
function parseReasons(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === "string") : []
  } catch {
    return []
  }
}

export async function getTweetMentionByTweetId(tweetId: string) {
  const [row] = await db
    .select()
    .from(tweetMentions)
    .where(eq(tweetMentions.tweetId, tweetId))
    .limit(1)
  return row ?? null
}

export async function setTweetMentionDismissed(tweetId: string, dismissed: boolean) {
  const [row] = await db
    .update(tweetMentions)
    .set({ dismissedAt: dismissed ? new Date().toISOString() : null })
    .where(eq(tweetMentions.tweetId, tweetId))
    .returning()
  return row ?? null
}

export async function listRepliesForMention(tweetMentionId: string) {
  return db
    .select()
    .from(tweetReplies)
    .where(eq(tweetReplies.tweetMentionId, tweetMentionId))
    .orderBy(asc(tweetReplies.createdAt))
}

/**
 * Written *before* the publish call, so a crash mid-send leaves evidence
 * rather than a gap.
 */
export async function createPendingReply(params: {
  tweetMentionId: string
  text: string
  sentByCsrName: string
  isDryRun: boolean
}) {
  const [row] = await db
    .insert(tweetReplies)
    .values({
      id: `trep_${crypto.randomUUID()}`,
      tweetMentionId: params.tweetMentionId,
      text: params.text,
      sentByCsrName: params.sentByCsrName,
      status: "pending",
      isDryRun: params.isDryRun,
      createdAt: new Date().toISOString(),
    })
    .returning()
  return row
}

export async function markReplySent(
  id: string,
  result: { platformReplyId: string; platformPermalink: string; sentAt: string },
) {
  const [row] = await db
    .update(tweetReplies)
    .set({ status: "sent", ...result })
    .where(eq(tweetReplies.id, id))
    .returning()
  return row
}

/** The row stays. An admin must be able to see that a send did not land. */
export async function markReplyFailed(id: string, error: string) {
  const [row] = await db
    .update(tweetReplies)
    .set({ status: "failed", error })
    .where(eq(tweetReplies.id, id))
    .returning()
  return row
}

/** True when an attempt is already in flight — a double-click must not double-post. */
export async function hasPendingReply(tweetMentionId: string): Promise<boolean> {
  const rows = await db
    .select({ id: tweetReplies.id })
    .from(tweetReplies)
    .where(
      and(eq(tweetReplies.tweetMentionId, tweetMentionId), eq(tweetReplies.status, "pending")),
    )
    .limit(1)
  return rows.length > 0
}

/** R17: every fetch and every send is auditable. */
export async function recordAgentAction(params: {
  stage: string
  status: "running" | "ok" | "failed" | "denied"
  detail?: string
  tweetMentionId?: string
  serviceRequestId?: string
  chatMessageId?: string
}) {
  await db.insert(agentActions).values({
    id: `act_${crypto.randomUUID()}`,
    stage: params.stage,
    status: params.status,
    detail: params.detail ?? null,
    tweetMentionId: params.tweetMentionId ?? null,
    serviceRequestId: params.serviceRequestId ?? null,
    chatMessageId: params.chatMessageId ?? null,
    timestamp: new Date().toISOString(),
  })
}

// --- Servicing tool data access (10-llm-integration) ---
//
// Every function here takes `customerId` as its FIRST argument, resolved from
// the session by the caller. No query accepts an id that came from a model.

export async function listCardsForCustomer(customerId: string) {
  return db
    .select({
      id: cards.id,
      lastFour: cards.lastFour,
      status: cards.status,
    })
    .from(cards)
    .where(eq(cards.customerId, customerId))
    .orderBy(asc(cards.lastFour))
}

/**
 * Scoped by customer *and* last four. A card belonging to someone else is not
 * found, rather than found-and-rejected — there is no code path that loads it.
 */
export async function getCardForCustomer(customerId: string, lastFour: string) {
  const [row] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.customerId, customerId), eq(cards.lastFour, lastFour)))
    .limit(1)
  return row ?? null
}

/**
 * Moves a card between states, conditional on it still being in `expected`.
 *
 * The tool reads the card, decides, then writes — two statements, so the state
 * can move in between. Without the predicate a concurrent `unblock_card` could
 * write `active` after a `freeze_card` succeeded, leaving a card the customer
 * reported stolen usable while *both* operations reported success. The update
 * matches nothing in that case and returns null, which the caller reports as a
 * failure rather than a silent overwrite.
 *
 * `expected` is optional only so a caller that genuinely does not care (the
 * seed) can omit it. Every servicing tool passes one.
 */
export async function setCardStatus(
  customerId: string,
  lastFour: string,
  status: "active" | "frozen" | "inactive",
  expected?: "active" | "frozen" | "inactive",
) {
  const predicates = [eq(cards.customerId, customerId), eq(cards.lastFour, lastFour)]
  if (expected) predicates.push(eq(cards.status, expected))

  const [row] = await db
    .update(cards)
    .set({ status })
    .where(and(...predicates))
    .returning()
  return row ?? null
}

export async function getCustomerProfile(customerId: string) {
  const [row] = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      status: customers.status,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)
  return row ?? null
}

export async function updateCustomerEmail(customerId: string, email: string) {
  const [row] = await db
    .update(customers)
    .set({ email })
    .where(eq(customers.id, customerId))
    .returning({ id: customers.id, email: customers.email })
  return row ?? null
}

// --- Transactions and profile (0006) ---

export async function listTransactionsForCustomer(customerId: string, limit = 20) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.customerId, customerId))
    .orderBy(desc(transactions.postedAt))
    .limit(limit)
}

/** Scoped by customer, so another customer's charge is not found. */
export async function getTransactionForCustomer(customerId: string, transactionId: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.customerId, customerId), eq(transactions.id, transactionId)))
    .limit(1)
  return row ?? null
}

/**
 * Suspends the charge and opens an investigation — the Reg Z posture. This is
 * deliberately not a reversal: `reversed` is the outcome of an investigation,
 * not its start.
 */
export async function markTransactionDisputed(
  customerId: string,
  transactionId: string,
  reason: string,
) {
  const [row] = await db
    .update(transactions)
    .set({ status: "disputed", disputedAt: new Date().toISOString(), disputeReason: reason })
    // Only a `posted` charge is disputable. Without this a repeat call would
    // reset `disputedAt` and overwrite the reason, and a call against a
    // `reversed` charge would drag a finished investigation back to disputed —
    // the one direction a dispute must never move.
    .where(
      and(
        eq(transactions.customerId, customerId),
        eq(transactions.id, transactionId),
        eq(transactions.status, "posted"),
      ),
    )
    .returning()
  return row ?? null
}

export async function updateCustomerPhone(customerId: string, phone: string) {
  const [row] = await db
    .update(customers)
    .set({ phone })
    .where(eq(customers.id, customerId))
    .returning({ id: customers.id, phone: customers.phone })
  return row ?? null
}

/**
 * Writes a finished servicing turn back onto the ticket.
 *
 * Without this the agent could classify, act, verify and reply while the
 * ticket still read "Raised / Medium / General Servicing" — the row as it was
 * created. The classification columns existed from `05-sqlite` and nothing had
 * ever filled them.
 *
 * `escalatedAt` is set once and never reset: it is the time-in-escalation
 * clock basis, and restarting it would hide how long a case has been stuck
 * (`lib/mock/types.ts`).
 */
export async function applyTurnOutcome(params: {
  serviceRequestId: string
  status: "resolved" | "initiated" | "escalated"
  intent: Intent | null
  issue: string | null
  priority: "low" | "medium" | "high"
  confidence: number
}) {
  const now = new Date().toISOString()

  const [row] = await db
    .update(serviceRequests)
    .set({
      status: params.status,
      intent: params.intent,
      issue: params.issue as typeof serviceRequests.$inferInsert.issue,
      priority: params.priority,
      // The intent, not the issue: `listGrievanceCases` reads this column back
      // as an `Intent`, so storing the finer-grained issue here mislabelled
      // every completed turn.
      classificationIntent: params.intent,
      classificationConfidence: params.confidence,
      // COALESCE in the statement rather than a read-then-write: the first
      // escalation timestamp is the one that counts, and reading it in a
      // separate query lets a second call overwrite it with a stale NULL.
      ...(params.status === "escalated"
        ? { escalatedAt: sql`COALESCE(${serviceRequests.escalatedAt}, ${now})` }
        : {}),
      updatedAt: now,
    })
    .where(eq(serviceRequests.id, params.serviceRequestId))
    .returning()
  return row ?? null
}
