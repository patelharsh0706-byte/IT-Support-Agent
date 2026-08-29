import { describe, expect, it } from "vitest"

import { sortCases } from "./conversation-views"
import type { GrievanceCase } from "@/lib/mock/types"

/**
 * The inbox must show what just happened. The bug this guards against: a case
 * opened five days ago and replied to a minute ago sorted five days down,
 * because the ordering keyed on `createdAt` rather than last activity.
 */

const iso = (minutesAgo: number) =>
  new Date(Date.UTC(2026, 7, 28, 12, 0, 0) - minutesAgo * 60_000).toISOString()

function makeCase(
  id: string,
  createdMinutesAgo: number,
  lastMessageMinutesAgo: number,
  severity: GrievanceCase["currentSeverity"] = "low",
): GrievanceCase {
  return {
    id,
    customerName: "Test",
    channel: "amex_support",
    summary: id,
    currentSeverity: severity,
    severityChangedRecently: false,
    createdAt: iso(createdMinutesAgo),
    escalatedAt: null,
    escalationReason: null,
    customerStatus: "active",
    customerVerified: true,
    contactedByCsrName: null,
    replyState: "needs_reply",
    dedupePosts: [],
    severityHistory: [],
    toolCallLog: [],
    realChatMessages: [
      {
        id: `${id}_m`,
        authorRole: "customer",
        authorName: "Test",
        content: "hello",
        timestamp: iso(lastMessageMinutesAgo),
        isPrivateNote: false,
      },
    ],
  }
}

describe("inbox ordering (default)", () => {
  it("puts the most recently active conversation first, not the newest case", () => {
    const old = makeCase("old_case_new_reply", 7200, 1) // 5 days old, replied a minute ago
    const fresh = makeCase("new_case_no_activity", 60, 60)
    expect(sortCases([fresh, old]).map((c) => c.id)).toEqual([
      "old_case_new_reply",
      "new_case_no_activity",
    ])
  })

  it("ignores severity — a low-severity conversation with a new message still leads", () => {
    const highOld = makeCase("high_stale", 7200, 7200, "high")
    const lowNew = makeCase("low_active", 7200, 2, "low")
    expect(sortCases([highOld, lowNew])[0].id).toBe("low_active")
  })

  it("a CSR reply lifts the conversation too, not only an inbound message", () => {
    const replied = makeCase("csr_replied", 7200, 3)
    replied.realChatMessages[0].authorRole = "csr"
    const quiet = makeCase("quiet", 7200, 500)
    expect(sortCases([quiet, replied])[0].id).toBe("csr_replied")
  })

  it("is the default when no sort is given", () => {
    const old = makeCase("recent_activity", 7200, 1)
    const fresh = makeCase("no_activity", 30, 30)
    expect(sortCases([fresh, old])[0].id).toBe("recent_activity")
  })
})

describe("queue ordering (reports/grievances) is unchanged", () => {
  it("still ranks severity first, then oldest within the band", () => {
    const lowNew = makeCase("low_active", 10, 1, "low")
    const highOld = makeCase("high_stale", 7200, 7200, "high")
    expect(sortCases([lowNew, highOld], "priority")[0].id).toBe("high_stale")
  })
})
