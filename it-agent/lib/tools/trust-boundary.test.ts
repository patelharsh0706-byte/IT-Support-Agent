import { describe, expect, it } from "vitest"

import { createCardTools } from "./cards"
import { createProfileTools } from "./profile"
import { toolNamesForIntent } from "@/lib/agent/scopes"

/**
 * The security contract this unit exists to hold, tested first.
 *
 * These are schema-level assertions: they prove a model *cannot express* a
 * request to act on another customer, rather than proving we remember to
 * reject one.
 */

const CUSTOMER = "cust_alice"

/**
 * The AI SDK types `inputSchema` as an opaque StandardSchema, but a Zod object
 * still carries `.shape` at runtime — which is what lets these tests assert on
 * the *declared parameters* rather than on behaviour.
 */
function schemaKeys(schema: unknown): string[] {
  const shape = (schema as { shape?: Record<string, unknown> })?.shape
  if (!shape) throw new Error("expected a Zod object schema with a .shape")
  return Object.keys(shape)
}

describe("Invariant 1 — no tool accepts a customer id", () => {
  const tools = { ...createCardTools(CUSTOMER), ...createProfileTools(CUSTOMER) }

  it.each(Object.keys(tools))("%s exposes no customer-identifying parameter", (name) => {
    const keys = schemaKeys(
      (tools as Record<string, { inputSchema: unknown }>)[name].inputSchema,
    ).map((k) => k.toLowerCase())

    for (const forbidden of ["customerid", "customer_id", "customer", "userid", "user_id", "clerkuserid"]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it("card tools accept only lastFour", () => {
    const cardTools = createCardTools(CUSTOMER)
    for (const name of ["unblock_card", "activate_card"] as const) {
      expect(schemaKeys(cardTools[name].inputSchema)).toEqual(["lastFour"])
    }
  })

  it("update_email accepts only an email", () => {
    expect(schemaKeys(createProfileTools(CUSTOMER).update_email.inputSchema)).toEqual(["email"])
  })
})

describe("Invariant 3 — capability scope", () => {
  it("a Card Servicing turn is handed only card tools", () => {
    expect(toolNamesForIntent("card_unblock_activation")).toEqual([
      "activate_card",
      "freeze_card",
      "get_cards",
      "unblock_card",
    ])
  })

  it("freeze_card takes no customer id, only lastFour and a reason", () => {
    const shape = schemaKeys(createCardTools(CUSTOMER).freeze_card.inputSchema)
    expect(shape.sort()).toEqual(["lastFour", "reason"])
  })

  it("a Card Servicing turn cannot reach a profile tool", () => {
    expect(toolNamesForIntent("card_unblock_activation")).not.toContain("update_email")
  })

  it("an Account & Profile turn cannot reach a card tool", () => {
    const names = toolNamesForIntent("update_contact_info")
    expect(names).toEqual(["get_profile", "update_email", "update_phone"].sort())
    expect(names).not.toContain("unblock_card")
  })

  it("a Dispute turn gets only transaction tools", () => {
    const names = toolNamesForIntent("unrecognized_transaction")
    expect(names).toEqual(["get_transactions", "initiate_dispute"])
    expect(names).not.toContain("unblock_card")
    expect(names).not.toContain("update_email")
  })

  it("no scope can reverse a charge — a reversal is an investigation outcome", () => {
    for (const intent of ["card_unblock_activation", "unrecognized_transaction", "update_contact_info"] as const) {
      expect(toolNamesForIntent(intent).some((n) => n.includes("revers") || n.includes("refund"))).toBe(false)
    }
  })
})

describe("Invariant 2 — the action tool is not its own witness", () => {
  it("no verifier is exposed to the model", () => {
    const exposed = [
      ...Object.keys(createCardTools(CUSTOMER)),
      ...Object.keys(createProfileTools(CUSTOMER)),
    ]
    expect(exposed.filter((n) => n.startsWith("verify"))).toEqual([])
  })
})

describe("Invariant 5 — the agent never publishes", () => {
  it("no tool can post anything outward", () => {
    const exposed = [
      ...Object.keys(createCardTools(CUSTOMER)),
      ...Object.keys(createProfileTools(CUSTOMER)),
    ]
    for (const forbidden of ["post", "publish", "reply", "send", "tweet", "email_customer"]) {
      expect(exposed.some((n) => n.includes(forbidden))).toBe(false)
    }
  })
})
