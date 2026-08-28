import { NextRequest } from "next/server"

import { requireCustomer } from "@/lib/auth/session"
import { runServicingTurn } from "@/lib/agent/pipeline"
import type { ActivityEvent } from "@/lib/agent/events"
import {
  getServiceRequestById,
  insertChatMessage,
  recordAgentAction,
  resolveCustomer,
} from "@/lib/sqlite/queries"

/** The pipeline may make two model calls and several tool calls. */
export const maxDuration = 60

/**
 * One servicing turn, streamed as newline-delimited JSON.
 *
 * Each stage emits an event the moment it happens, so the Agent Activity panel
 * shows classification, priority, tool execution and verification as they
 * occur rather than after the fact (success criterion 2). The same events are
 * written to `agent_actions` — one emit, live view and audit trail both.
 */
export async function POST(request: NextRequest) {
  const session = await requireCustomer().catch(() => null)
  if (!session) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === "string" ? body.message.trim() : ""
  const serviceRequestId = typeof body.serviceRequestId === "string" ? body.serviceRequestId : null

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 })
  }
  if (!serviceRequestId) {
    return Response.json({ error: "serviceRequestId is required" }, { status: 400 })
  }

  // Invariant 1: the customer is resolved here, from the session. Nothing
  // downstream — and no model — ever supplies an identity.
  const customer = await resolveCustomer(session.clerkUserId)
  const serviceRequest = await getServiceRequestById(serviceRequestId)

  if (!serviceRequest) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  if (serviceRequest.customerId !== customer.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // Persisted before the stream opens, so the customer's own message survives
  // even if the turn fails halfway.
  const customerMessage = await insertChatMessage({
    serviceRequestId,
    customerId: customer.id,
    authorRole: "customer",
    authorName: customer.name,
    content: message,
    isPrivateNote: false,
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))

      const emit = async (event: ActivityEvent) => {
        send({ type: "activity", event })
        // Persisted as it happens, so a crash mid-turn still leaves a trail.
        await recordAgentAction({
          stage: event.stage,
          status: event.status,
          detail: event.detail,
          serviceRequestId,
        })
      }

      // The row as stored, so the client renders a real message with the
      // server's id and timestamp rather than inventing one.
      send({ type: "accepted", message: customerMessage })

      try {
        const result = await runServicingTurn({
          customerId: customer.id,
          message,
          emit,
        })

        const reply = await insertChatMessage({
          serviceRequestId,
          customerId: customer.id,
          authorRole: "agent",
          authorName: "Servicing Agent",
          content: result.reply,
          isPrivateNote: false,
        })

        send({
          type: "result",
          outcome: result.outcome,
          issue: result.classification.issue,
          priority: result.priority?.priority ?? null,
          escalationReason: result.escalationReason ?? null,
          message: reply,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        await recordAgentAction({
          stage: "execute",
          status: "failed",
          detail,
          serviceRequestId,
        })
        send({ type: "error", error: detail })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
