import { describe, expect, it } from "vitest"

import { decidePriority } from "./priority"

/** Priority is decided in code, never by the model. It may be raised, never lowered. */

describe("declared defaults", () => {
  it.each([
    ["card_unblock", "high"],
    ["card_activation", "medium"],
    ["report_lost_stolen", "high"],
    ["unrecognized_transaction", "high"],
    ["duplicate_charge", "medium"],
    ["update_phone", "medium"],
    ["update_email", "low"],
  ] as const)("%s defaults to %s", (issue, expected) => {
    expect(decidePriority(issue, "plain message").priority).toBe(expected)
  })
})

describe("severity signals raise, one band, never lower", () => {
  it("raises low to medium", () => {
    const result = decidePriority("update_email", "urgent please, I am stranded abroad")
    expect(result.base).toBe("low")
    expect(result.priority).toBe("medium")
    expect(result.reasons).toContain("Stated urgency")
  })

  it("raises medium to high on fraud language", () => {
    expect(decidePriority("card_activation", "there is a fraudulent charge").priority).toBe("high")
  })

  it("cannot exceed high", () => {
    const result = decidePriority(
      "card_unblock",
      "fraud, I am closing my account and contacting the regulator, urgent",
    )
    expect(result.priority).toBe("high")
    expect(result.reasons.length).toBeGreaterThan(2)
  })

  it("never lowers a high-default issue", () => {
    expect(decidePriority("card_unblock", "no rush, whenever you can").priority).toBe("high")
  })

  it("records every signal that fired", () => {
    const result = decidePriority("update_email", "urgent — I am leaving Amex over this")
    expect(result.reasons).toContain("Stated urgency")
    expect(result.reasons).toContain("Stated churn")
  })
})
