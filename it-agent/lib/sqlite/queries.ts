import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { currentUser } from "@clerk/nextjs/server"
import { cache } from "react"
import { db } from "./client"
import {
  agentActions,
  chatMessages,
  chatSessions,
  customers,
  serviceRequests,
  severityChanges,
  socialPosts,
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
 * Atomic escalate: bumps status/priority/severity, records the reason, and
 * inserts a chat message so the CSR sees *why* right in the shared thread —
 * not just an `escalated_at` timestamp.
 */
export async function escalateServiceRequest(
  serviceRequestId: string,
  reason: string,
  customerId: string,
  customerName: string,
) {
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
        escalatedAt: now,
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

    const session =
      (await tx.query.chatSessions.findFirst({
        where: eq(chatSessions.serviceRequestId, serviceRequestId),
      })) ??
      (
        await tx
          .insert(chatSessions)
          .values({ id: `sess_${crypto.randomUUID()}`, customerId, serviceRequestId })
          .returning()
      )[0]

    await tx.insert(chatMessages).values({
      id: `msg_${crypto.randomUUID()}`,
      chatSessionId: session.id,
      authorRole: "customer",
      authorName: customerName,
      content: reason,
      timestamp: now,
      isPrivateNote: false,
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
