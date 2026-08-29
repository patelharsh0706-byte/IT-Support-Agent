import { describe, expect, it } from "vitest"

import { createMutationLog } from "./mutations"

// Verification runs once, after the tool loop. A log that appended every write
// would have it check a superseded expectation against the final stored value
// and escalate a turn whose last write succeeded.
describe("the mutation log records the end state, not the history", () => {
  it("keeps only the latest write for the same target", () => {
    const log = createMutationLog()
    log.record({ kind: "email", expected: "first@example.com" })
    log.record({ kind: "email", expected: "second@example.com" })

    expect(log.mutations).toEqual([{ kind: "email", expected: "second@example.com" }])
  })

  it("treats each card as its own target", () => {
    const log = createMutationLog()
    log.record({ kind: "card_status", lastFour: "4821", expected: "frozen" })
    log.record({ kind: "card_status", lastFour: "0093", expected: "active" })

    expect(log.mutations).toHaveLength(2)
  })

  it("collapses a card written twice to its final state", () => {
    const log = createMutationLog()
    log.record({ kind: "card_status", lastFour: "4821", expected: "frozen" })
    log.record({ kind: "card_status", lastFour: "4821", expected: "active" })

    expect(log.mutations).toEqual([
      { kind: "card_status", lastFour: "4821", expected: "active" },
    ])
  })

  it("treats each disputed transaction as its own target", () => {
    const log = createMutationLog()
    log.record({ kind: "dispute", transactionId: "txn_1" })
    log.record({ kind: "dispute", transactionId: "txn_2" })

    expect(log.mutations).toHaveLength(2)
  })

  it("keeps email and phone apart", () => {
    const log = createMutationLog()
    log.record({ kind: "email", expected: "a@example.com" })
    log.record({ kind: "phone", expected: "+65 9123 4567" })

    expect(log.mutations).toHaveLength(2)
  })

  it("preserves the order the tools ran in", () => {
    const log = createMutationLog()
    log.record({ kind: "email", expected: "a@example.com" })
    log.record({ kind: "phone", expected: "+65 9123 4567" })
    log.record({ kind: "email", expected: "b@example.com" })

    expect(log.mutations.map((m) => m.kind)).toEqual(["email", "phone"])
  })
})
