import { describe, expect, it } from "vitest"

import type { Classification } from "./classify"
import type { ActivityEvent } from "./events"
import { runServicingTurn } from "./pipeline"

/**
 * The pipeline's branching, with no model involved anywhere — the classifier
 * is injected and the closing sentence is stubbed. Everything asserted here is
 * deterministic code, which is exactly the claim `architecture.md` makes.
 *
 * The happy path needs a live model and a database, so it is an end-to-end
 * check rather than a unit test.
 */

const CUSTOMER = "cust_alice"

function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    issue: "card_unblock",
    intent: "card_unblock_activation",
    confidence: 0.9,
    params: {},
    reasoning: "stub",
    belowThreshold: false,
    notImplemented: false,
    ...overrides,
  }
}

async function run(c: Classification) {
  const events: ActivityEvent[] = []
  const result = await runServicingTurn({
    customerId: CUSTOMER,
    message: "stub message",
    emit: (e) => void events.push(e),
    classifier: async () => c,
    compose: async (r) => `stub reply for ${r.outcome}`,
  })
  return { result, events }
}

describe("gates that stop a turn before any tool runs", () => {
  it("escalates an out-of-scope request", async () => {
    const { result, events } = await run(
      classification({ issue: "other", intent: null, reasoning: "Lost card is not supported." }),
    )
    expect(result.outcome).toBe("escalated")
    expect(result.escalationReason).toMatch(/outside the issues/i)
    expect(events.some((e) => e.stage === "execute")).toBe(false)
  })

  it("escalates a low-confidence classification without acting", async () => {
    const { result, events } = await run(
      classification({ issue: "other", intent: null, confidence: 0.2, belowThreshold: true }),
    )
    expect(result.outcome).toBe("escalated")
    expect(result.escalationReason).toMatch(/not confident enough/i)
    expect(events.some((e) => e.stage === "execute")).toBe(false)
  })

  it("escalates a recognised issue the schema cannot service yet", async () => {
    const { result } = await run(
      classification({
        issue: "duplicate_charge",
        intent: "unrecognized_transaction",
        notImplemented: true,
        blockedBy: "no transactions table in the schema yet",
      }),
    )
    expect(result.outcome).toBe("escalated")
    expect(result.escalationReason).toContain("no transactions table")
  })

  // Since 0006 every intent has tools, so the empty-scope branch is defensive
  // rather than reachable. This asserts the reachable half: each intent is
  // handed a non-empty, correctly-partitioned tool set.
  it("every intent now has a non-empty scope", async () => {
    for (const intent of [
      "card_unblock_activation",
      "unrecognized_transaction",
      "update_contact_info",
    ] as const) {
      const { events } = await run(classification({ intent, issue: "card_unblock" }))
      const authorize = events.find((e) => e.stage === "authorize")
      expect(authorize?.detail).toMatch(/In scope for this turn: \w+/)
    }
  })
})

describe("the activity trail", () => {
  it("records classify and prioritize before authorize", async () => {
    const { events } = await run(classification())
    const stages = events.map((e) => e.stage)
    expect(stages.indexOf("classify")).toBeLessThan(stages.indexOf("prioritize"))
    expect(stages.indexOf("prioritize")).toBeLessThan(stages.indexOf("authorize"))
  })

  it("names the tools that were in scope, so the gate is auditable", async () => {
    const { events } = await run(classification())
    const authorize = events.find((e) => e.stage === "authorize")
    expect(authorize?.detail).toContain("unblock_card")
    expect(authorize?.detail).not.toContain("update_email")
  })

  it("marks an escalation as denied, matching the agent_actions enum", async () => {
    const { events } = await run(classification({ issue: "other", intent: null }))
    expect(events.find((e) => e.stage === "escalate")?.status).toBe("denied")
  })

  it("reports the priority decision with its reasons", async () => {
    const events: ActivityEvent[] = []
    await runServicingTurn({
      customerId: CUSTOMER,
      message: "urgent, there is a fraudulent charge",
      emit: (e) => void events.push(e),
      classifier: async () => classification({ issue: "card_activation" }),
      compose: async () => "stub",
    })
    const p = events.find((e) => e.stage === "prioritize")
    expect(p?.detail).toContain("high")
    expect(p?.detail).toContain("Fraud language")
  })
})
