import { describe, expect, it } from "vitest"

import { CONFIDENCE_THRESHOLD, interpret, type RawClassification } from "./classify"

/**
 * The classifier's *rules*, tested without a model. The network call is a thin
 * wrapper around `interpret`, so everything that decides behaviour is here and
 * the suite stays deterministic.
 */

function raw(overrides: Partial<RawClassification> = {}): RawClassification {
  return {
    issue: "card_unblock",
    confidence: 0.9,
    lastFour: null,
    email: null,
    reasoning: "Customer says the card is blocked.",
    ...overrides,
  }
}

describe("confident, supported issues route", () => {
  it("maps card_unblock to its intent", () => {
    const result = interpret(raw())
    expect(result.issue).toBe("card_unblock")
    expect(result.intent).toBe("card_unblock_activation")
    expect(result.notImplemented).toBe(false)
  })

  it("maps update_email to the profile intent", () => {
    const result = interpret(raw({ issue: "update_email", email: "new@example.com" }))
    expect(result.intent).toBe("update_contact_info")
    expect(result.params.email).toBe("new@example.com")
  })

  it("carries lastFour through as a parameter", () => {
    expect(interpret(raw({ lastFour: "4821" })).params.lastFour).toBe("4821")
  })
})

describe("low confidence collapses to other", () => {
  it("treats a below-threshold answer as no answer", () => {
    const result = interpret(raw({ confidence: CONFIDENCE_THRESHOLD - 0.01 }))
    expect(result.issue).toBe("other")
    expect(result.intent).toBeNull()
    expect(result.belowThreshold).toBe(true)
  })

  it("drops extracted parameters when it collapses", () => {
    const result = interpret(raw({ confidence: 0.2, lastFour: "4821" }))
    expect(result.params).toEqual({})
  })

  it("accepts an answer exactly at the threshold", () => {
    expect(interpret(raw({ confidence: CONFIDENCE_THRESHOLD })).issue).toBe("card_unblock")
  })
})

describe("out of scope", () => {
  it("passes `other` through with no intent", () => {
    const result = interpret(raw({ issue: "other", confidence: 0.95 }))
    expect(result.issue).toBe("other")
    expect(result.intent).toBeNull()
  })

  it("a lost card is now its own issue, not `other`", () => {
    const result = interpret(raw({ issue: "report_lost_stolen", confidence: 0.9 }))
    expect(result.intent).toBe("card_unblock_activation")
    expect(result.notImplemented).toBe(false)
  })
})

describe("all seven issues are serviceable", () => {
  it.each([
    "card_unblock",
    "card_activation",
    "report_lost_stolen",
    "unrecognized_transaction",
    "duplicate_charge",
    "update_phone",
    "update_email",
  ] as const)("%s is implemented", (issue) => {
    const result = interpret(raw({ issue, confidence: 0.95 }))
    expect(result.issue).toBe(issue)
    expect(result.notImplemented).toBe(false)
    expect(result.intent).not.toBeNull()
  })

  it("every issue maps to one of the three intents", () => {
    const intents = new Set(
      (["card_unblock", "card_activation", "report_lost_stolen",
        "unrecognized_transaction", "duplicate_charge", "update_phone",
        "update_email"] as const)
        .map((issue) => interpret(raw({ issue })).intent),
    )
    expect(intents).toEqual(
      new Set(["card_unblock_activation", "unrecognized_transaction", "update_contact_info"]),
    )
  })
})


