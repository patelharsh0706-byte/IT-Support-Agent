import { describe, expect, it } from "vitest"

import { isGrievance, scoreTweet } from "./urgency"
import type { RawTweet } from "./tweet-source"

const NOW = new Date("2026-08-27T12:00:00Z")

function tweet(overrides: Partial<RawTweet> = {}): RawTweet {
  return {
    tweetId: "t1",
    authorHandle: "someone",
    authorName: "Someone",
    text: "placeholder",
    postedAt: "2026-08-27T11:00:00Z",
    permalink: "https://x.com/someone/status/t1",
    replyCount: 0,
    likeCount: 0,
    ...overrides,
  }
}

// Negative cases first: a false positive here wastes CSR time, which is the
// thing this product claims to save.
describe("the gate rejects non-grievances", () => {
  it("treats praise as not a grievance", () => {
    expect(
      isGrievance({
        text: "Genuinely impressed — @AmexHelp replaced my card and had it couriered same day.",
      })
    ).toBe(false)
  })

  it("treats an unrelated brand mention as not a grievance", () => {
    expect(
      isGrievance({
        text: "Payments roundup: @AmexHelp and two other issuers are expanding contactless limits.",
      })
    ).toBe(false)
  })

  it("scores a non-grievance normal with no reasons", () => {
    const score = scoreTweet(tweet({ text: "Thanks @AmexHelp, sorted it in minutes" }), { now: NOW })
    expect(score).toEqual({ isGrievance: false, urgency: "normal", reasons: [] })
  })

  it("does not let reach alone promote a non-grievance", () => {
    const score = scoreTweet(
      tweet({ text: "Great service from @AmexHelp today", likeCount: 5000, replyCount: 900 }),
      { now: NOW }
    )
    expect(score.urgency).toBe("normal")
  })
})

describe("the gate accepts grievances", () => {
  it("accepts a plain complaint", () => {
    expect(isGrievance({ text: "@AmexHelp my card has been blocked since Tuesday" })).toBe(true)
  })

  it("accepts fraud language even when politely phrased", () => {
    expect(
      isGrievance({ text: "Thank you, but there are two charges I did not make on my statement" })
    ).toBe(true)
  })
})

describe("critical rules", () => {
  it("flags a stated account closure", () => {
    const score = scoreTweet(
      tweet({ text: "I have closed my card and moved to another issuer" }),
      { now: NOW }
    )
    expect(score.urgency).toBe("critical")
    expect(score.reasons).toContain("Customer states they closed or left")
  })

  it("flags a regulator threat", () => {
    const score = scoreTweet(
      tweet({ text: "If I do not hear back today I am filing with the regulator" }),
      { now: NOW }
    )
    expect(score.urgency).toBe("critical")
  })

  it("flags missing money", () => {
    const score = scoreTweet(
      tweet({ text: "A charge posted twice and the money is still missing" }),
      { now: NOW }
    )
    expect(score.urgency).toBe("critical")
  })
})

describe("high rules", () => {
  it("flags an aged unanswered grievance", () => {
    const score = scoreTweet(
      tweet({ text: "still chasing this, no response", postedAt: "2026-08-25T12:00:00Z" }),
      { now: NOW }
    )
    expect(score.urgency).toBe("high")
    expect(score.reasons.some((r) => r.includes("Unanswered for"))).toBe(true)
  })

  it("flags a repeat post from a handle already in the feed", () => {
    const score = scoreTweet(tweet({ text: "still blocked, anyone home?" }), {
      now: NOW,
      knownHandles: new Set(["someone"]),
    })
    expect(score.urgency).toBe("high")
    expect(score.reasons).toContain("Repeat post from a handle already in the feed")
  })

  it("flags reach", () => {
    const score = scoreTweet(tweet({ text: "card declined again, useless", likeCount: 96 }), {
      now: NOW,
    })
    expect(score.urgency).toBe("high")
  })
})

// Both of these were real misses caught by running the fixture corpus, not by
// the tests above — the corpus is the negative-case harness the spec asks for.
describe("regressions from the fixture corpus", () => {
  it("flags closure phrased with 'the' rather than 'my'", () => {
    const score = scoreTweet(
      tweet({ text: "I have closed the card and moved everything to another issuer" }),
      { now: NOW }
    )
    expect(score.urgency).toBe("critical")
  })

  it("flags leaving for another issuer however it is phrased", () => {
    for (const text of [
      "switching to another issuer after this",
      "closed the account last week, done with this",
      "moving to another card, nobody has replied",
    ]) {
      expect(scoreTweet(tweet({ text }), { now: NOW }).urgency).toBe("critical")
    }
  })
})

describe("rules never lower a level a prior rule set", () => {
  it("keeps critical when a high rule also fires", () => {
    const score = scoreTweet(
      tweet({
        text: "I closed my account after chasing this for months with no response",
        postedAt: "2026-08-20T12:00:00Z",
        likeCount: 400,
      }),
      { now: NOW, knownHandles: new Set(["someone"]) }
    )
    expect(score.urgency).toBe("critical")
    // Every rule that fired still contributes its reason.
    expect(score.reasons.length).toBeGreaterThan(2)
  })
})
