import { describe, expect, it } from "vitest"

import { groupActivityIntoTurns } from "./activity-turns"
import type { ActivityEvent } from "./types"

let seq = 0
function ev(stage: string, status: ActivityEvent["status"], minutesAgo: number): ActivityEvent {
  seq += 1
  return {
    id: `e${seq}`,
    stage,
    status,
    detail: "d",
    timestamp: new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString(),
  }
}

describe("grouping", () => {
  it("keeps one run together", () => {
    const turns = groupActivityIntoTurns([
      ev("classify", "running", 10),
      ev("prioritize", "ok", 10),
      ev("confirm", "ok", 10),
    ])
    expect(turns).toHaveLength(1)
    expect(turns[0].events).toHaveLength(3)
  })

  it("splits two runs separated by a long gap", () => {
    const turns = groupActivityIntoTurns([
      ev("classify", "running", 60),
      ev("confirm", "ok", 60),
      ev("classify", "running", 5),
      ev("confirm", "ok", 5),
    ])
    expect(turns).toHaveLength(2)
  })

  it("puts the newest turn first", () => {
    const turns = groupActivityIntoTurns([
      ev("classify", "running", 60),
      ev("classify", "running", 5),
    ])
    expect(new Date(turns[0].startedAt).getTime()).toBeGreaterThan(
      new Date(turns[1].startedAt).getTime(),
    )
  })

  it("keeps events chronological inside a turn — a turn read backwards is nonsense", () => {
    const turns = groupActivityIntoTurns([
      ev("classify", "running", 10),
      ev("verify", "ok", 10),
      ev("confirm", "ok", 10),
    ])
    expect(turns[0].events.map((e) => e.stage)).toEqual(["classify", "verify", "confirm"])
  })

  it("groups legacy rows that use different stage names", () => {
    const turns = groupActivityIntoTurns([
      ev("Channel triage", "ok", 30),
      ev("Customer authentication", "ok", 30),
      ev("Freeze card", "running", 30),
    ])
    expect(turns).toHaveLength(1)
  })

  // Regression: the boundary rule matched any `classify` event, so a turn was
  // split at its own classify/ok a moment after classify/running.
  it("does not split a turn at its own second classify event", () => {
    const turns = groupActivityIntoTurns([
      ev("classify", "running", 5),
      ev("classify", "ok", 5),
      ev("prioritize", "ok", 5),
      ev("confirm", "ok", 5),
    ])
    expect(turns).toHaveLength(1)
    expect(turns[0].events).toHaveLength(4)
  })

  it("still splits two back-to-back turns seconds apart", () => {
    const turns = groupActivityIntoTurns([
      ev("classify", "running", 5),
      ev("confirm", "ok", 5),
      ev("classify", "running", 4),
      ev("confirm", "ok", 4),
    ])
    expect(turns).toHaveLength(2)
  })

  it("returns nothing for an empty log", () => {
    expect(groupActivityIntoTurns([])).toEqual([])
  })
})

describe("outcome", () => {
  it("reads escalated from a denied step", () => {
    expect(
      groupActivityIntoTurns([ev("classify", "ok", 5), ev("escalate", "denied", 5)])[0].outcome,
    ).toBe("escalated")
  })

  it("reads resolved from a confirmed step", () => {
    expect(
      groupActivityIntoTurns([ev("classify", "ok", 5), ev("confirm", "ok", 5)])[0].outcome,
    ).toBe("resolved")
  })

  it("reads failed when a step failed and nothing escalated after it", () => {
    expect(
      groupActivityIntoTurns([ev("classify", "ok", 5), ev("execute", "failed", 5)])[0].outcome,
    ).toBe("failed")
  })

  it("reads running while a turn is still in flight", () => {
    expect(groupActivityIntoTurns([ev("classify", "running", 5)])[0].outcome).toBe("running")
  })
})
