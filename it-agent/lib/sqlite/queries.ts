import { and, desc, eq, inArray } from "drizzle-orm"
import { currentUser } from "@clerk/nextjs/server"
import { cache } from "react"
import { db } from "./client"
import {
  agentActions,
  customers,
  serviceRequests,
  severityChanges,
  socialPosts,
} from "./schema"
import type { DashboardMetrics, GrievanceCase, Intent } from "@/lib/mock/types"

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

  const [relatedCustomers, allSocialPosts, allSeverityChanges, allAgentActions] = await Promise.all([
    customerIds.length > 0
      ? db.select().from(customers).where(inArray(customers.id, customerIds))
      : Promise.resolve([]),
    db.select().from(socialPosts).where(inArray(socialPosts.serviceRequestId, requestIds)),
    db.select().from(severityChanges).where(inArray(severityChanges.serviceRequestId, requestIds)),
    db.select().from(agentActions).where(inArray(agentActions.serviceRequestId, requestIds)),
  ])

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
