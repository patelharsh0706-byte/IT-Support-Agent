import { describe, expect, it } from "vitest"

import { checkReply } from "./reply-guard"

function rules(text: string): string[] {
  const result = checkReply(text)
  return result.ok ? [] : result.violations.map((v) => v.rule)
}

// The intended shape of a public reply: acknowledge, apologise, hand off to a
// secure channel. These must pass, or the guard is unusable.
describe("acknowledge-and-handoff replies pass", () => {
  it("allows a plain acknowledgement", () => {
    expect(
      checkReply(
        "We're sorry about this and we want to get it sorted. Please DM us and our team will pick it up from there.",
      ).ok,
    ).toBe(true)
  })

  it("allows mentioning a timeframe", () => {
    expect(
      checkReply("Thanks for flagging — we've escalated this and will come back to you within 24 hours.").ok,
    ).toBe(true)
  })

  it("allows a case reference that is not an identifier", () => {
    expect(checkReply("We've raised this with our servicing team. Please DM us to continue.").ok).toBe(true)
  })
})

describe("account specifics are blocked", () => {
  it("blocks a full card number", () => {
    expect(rules("We can see your card 4111 1111 1111 1111 is blocked")).toContain("card-number")
  })

  it("blocks a card number written without spaces", () => {
    expect(rules("Card 4111111111111111 has been unblocked")).toContain("card-number")
  })

  it("blocks last-four digits", () => {
    expect(rules("Your card ending 4821 has been reactivated")).toContain("last-four")
  })

  it("blocks a security code", () => {
    expect(rules("Please confirm the CVV 123 for us")).toContain("security-code")
  })

  it("blocks an amount", () => {
    expect(rules("We've refunded the $214.50 charge")).toContain("amount")
  })

  // The gap: a symbol was caught, a currency code was not, so "We refunded
  // USD 100" was publishable.
  it("blocks a currency-code amount", () => {
    expect(rules("We refunded USD 100.")).toContain("amount")
    expect(rules("EUR 250 has been credited")).toContain("amount")
    expect(rules("we sent sgd 1,250.00 back")).toContain("amount")
  })

  it("blocks a balance reference", () => {
    expect(rules("Your available credit has been restored")).toContain("balance")
  })

  it("blocks a transaction identifier", () => {
    expect(rules("Please quote reference ABC123456 when you call")).toContain("transaction-id")
  })
})

describe("mechanics", () => {
  it("blocks an empty reply", () => {
    expect(rules("   ")).toContain("empty")
  })

  it("blocks a reply over the platform limit", () => {
    expect(rules("a".repeat(281))).toContain("length")
  })

  it("reports every rule that fired, not just the first", () => {
    const fired = rules("Refunded $214.50 to the card ending 4821")
    expect(fired).toContain("amount")
    expect(fired).toContain("last-four")
  })

  it("names the rule so the rejection is fixable", () => {
    const result = checkReply("card 4111 1111 1111 1111")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations[0].message.length).toBeGreaterThan(10)
    }
  })
})
