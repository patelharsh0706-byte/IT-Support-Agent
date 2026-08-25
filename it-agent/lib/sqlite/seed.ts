import { db } from "./client"
import {
  agentActions,
  cards,
  chatMessages,
  chatSessions,
  customers,
  serviceRequests,
  severityChanges,
  socialPosts,
} from "./schema"
import { tickets, chatMessages as mockChatMessages, grievanceCases } from "../mock/fixtures"

// Ports `it-agent/lib/mock/fixtures.ts` into rows per the mapping in
// `feature-specs/05-sqlite.md`. Safe to re-run: each table is cleared first.

async function seed() {
  // Wrapped in one transaction so a failure partway through (e.g. a bad
  // fixture row) rolls back the clears and inserts already run, rather than
  // leaving the DB half-cleared.
  await db.transaction(async (tx) => {
    // Clear in fk-dependency order.
    await tx.delete(agentActions)
    await tx.delete(severityChanges)
    await tx.delete(socialPosts)
    await tx.delete(chatMessages)
    await tx.delete(chatSessions)
    await tx.delete(serviceRequests)
    await tx.delete(cards)
    await tx.delete(customers)

    // --- Customers ---
    // One customer per chat ticket thread, one per named grievance case, plus
    // the dedicated closed-account fixture required by
    // `context/project-overview.md` Success Criteria 5.
    await tx.insert(customers).values([
      { id: "cust_you", name: "You", email: "you@example.com", status: "active" },
      { id: "cust_dana_marcus", name: "Dana Marcus", email: "dana.marcus@example.com", status: "closed" },
      { id: "cust_priya_nair", name: "Priya Nair", email: "priya.nair@example.com", status: "active" },
      { id: "cust_alex_whitfield", name: "Alex Whitfield", email: "alex.whitfield@example.com", status: "unknown" },
      { id: "cust_marcus_hale", name: "Marcus Hale", email: "marcus.hale@example.com", status: "active" },
    ])

    // --- Cards --- (last-four numbers referenced inline in fixtures.ts)
    await tx.insert(cards).values([
      { id: "card_4821", customerId: "cust_you", lastFour: "4821", status: "active" },
      { id: "card_0093", customerId: "cust_you", lastFour: "0093", status: "inactive" },
    ])

    // --- service_request: chat tickets (Ticket[]) ---
    const ticketCustomerId: Record<string, string> = {
      tkt_1: "cust_you",
      tkt_2: "cust_you",
      tkt_3: "cust_you",
      tkt_4: "cust_you",
      tkt_5: "cust_you",
      tkt_6: "cust_you",
    }

    await tx.insert(serviceRequests).values(
      tickets.map((t) => ({
        id: t.id,
        customerId: ticketCustomerId[t.id],
        channel: "amex_support" as const,
        intent: t.intent,
        title: t.title,
        priority: t.priority,
        status: t.status,
        currentSeverity: t.priority,
        customerVerified: true,
        replyState: "replied" as const,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    )

    // --- chat_sessions + chat_messages + agent_actions (ChatMessage[]) ---
    // Fixtures only cover tkt_3's thread today.
    const ticketIdsWithMessages = [...new Set(mockChatMessages.map((m) => m.ticketId))]
    await tx.insert(chatSessions).values(
      ticketIdsWithMessages.map((ticketId) => ({
        id: `sess_${ticketId}`,
        customerId: ticketCustomerId[ticketId],
        serviceRequestId: ticketId,
      })),
    )

    await tx.insert(chatMessages).values(
      mockChatMessages.map((m) => ({
        id: m.id,
        chatSessionId: `sess_${m.ticketId}`,
        authorRole: m.authorRole,
        authorName: m.authorName,
        content: m.content,
        timestamp: m.timestamp,
      })),
    )

    const chatActivityRows = mockChatMessages.flatMap((m) =>
      (m.activityEvents ?? []).map((e) => ({
        id: e.id,
        chatMessageId: m.id,
        serviceRequestId: null,
        stage: e.stage,
        status: e.status,
        detail: e.detail ?? null,
        timestamp: e.timestamp,
      })),
    )
    if (chatActivityRows.length > 0) {
      await tx.insert(agentActions).values(chatActivityRows)
    }

    // --- service_request: grievance cases (GrievanceCase[]) ---
    const caseCustomerId: Record<string, string> = {
      case_1: "cust_dana_marcus",
      case_2: "cust_priya_nair",
      case_3: "cust_alex_whitfield",
      case_4: "cust_marcus_hale",
    }

    await tx.insert(serviceRequests).values(
      grievanceCases.map((c) => ({
        id: c.id,
        customerId: caseCustomerId[c.id],
        channel: c.channel,
        // Null, not a guessed default, when the fixture carries no
        // classification — matches the nullable-until-classified contract
        // `service_request.intent` now has (`06-project-api.md`).
        intent: c.classification?.intent ?? null,
        title: c.summary,
        priority: c.currentSeverity,
        status: c.replyState === "escalated" ? ("escalated" as const) : ("open" as const),
        currentSeverity: c.currentSeverity,
        customerVerified: c.customerVerified,
        escalatedAt: c.escalatedAt,
        contactedByCsrName: c.contactedByCsrName,
        replyState: c.replyState,
        originalPostUrl: c.originalPostUrl ?? null,
        classificationIntent: c.classification?.intent ?? null,
        classificationConfidence: c.classification?.confidence ?? null,
        aiDraftReply: c.aiDraftReply ?? null,
        createdAt: c.createdAt,
        updatedAt: c.createdAt,
      })),
    )

    const dedupeRows = grievanceCases.flatMap((c) =>
      c.dedupePosts.map((p) => ({
        id: p.id,
        serviceRequestId: c.id,
        permalink: p.permalink,
        excerpt: p.excerpt,
        postedAt: p.postedAt,
      })),
    )
    if (dedupeRows.length > 0) await tx.insert(socialPosts).values(dedupeRows)

    const severityRows = grievanceCases.flatMap((c) =>
      c.severityHistory.map((s) => ({
        id: s.id,
        serviceRequestId: c.id,
        fromSeverity: s.from,
        toSeverity: s.to,
        changedAt: s.changedAt,
        reason: s.reason ?? null,
      })),
    )
    if (severityRows.length > 0) await tx.insert(severityChanges).values(severityRows)

    const caseActionRows = grievanceCases.flatMap((c) =>
      c.toolCallLog.map((e) => ({
        id: e.id,
        serviceRequestId: c.id,
        chatMessageId: null,
        stage: e.stage,
        status: e.status,
        detail: e.detail ?? null,
        timestamp: e.timestamp,
      })),
    )
    if (caseActionRows.length > 0) await tx.insert(agentActions).values(caseActionRows)
  })

  console.log("Seed complete.")
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
