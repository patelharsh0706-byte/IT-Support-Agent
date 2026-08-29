import { afterEach, describe, expect, it } from "vitest"

import {
  getTweetSource,
  isPublishLive,
  publishBlockedReason,
  readOAuth1Credentials,
  TweetSourceConfigError,
} from "./source-factory"

const KEYS = [
  "TWEET_SOURCE",
  "TWEET_PUBLISH",
  "X_BEARER_TOKEN",
  "X_SEARCH_QUERY",
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
] as const

afterEach(() => {
  for (const key of KEYS) delete process.env[key]
})

function withPublishCredentials() {
  process.env.X_API_KEY = "ck"
  process.env.X_API_SECRET = "cs"
  process.env.X_ACCESS_TOKEN = "at"
  process.env.X_ACCESS_TOKEN_SECRET = "ats"
}

describe("choosing a source", () => {
  it("defaults to fixtures, so a fresh clone runs offline", () => {
    expect(getTweetSource().kind).toBe("fixture")
  })

  it("returns the live source when a key is present", () => {
    process.env.TWEET_SOURCE = "live"
    process.env.X_BEARER_TOKEN = "bearer-abc"
    expect(getTweetSource().kind).toBe("live")
  })

  it("throws rather than serving fixtures while claiming to be live", () => {
    process.env.TWEET_SOURCE = "live"
    expect(() => getTweetSource()).toThrow(TweetSourceConfigError)
    expect(() => getTweetSource()).toThrow(/X_BEARER_TOKEN/)
  })

  it("treats a whitespace-only key as absent", () => {
    process.env.TWEET_SOURCE = "live"
    process.env.X_BEARER_TOKEN = "   "
    expect(() => getTweetSource()).toThrow(TweetSourceConfigError)
  })
})

describe("publish credentials are all four or none", () => {
  it("reads a complete set", () => {
    withPublishCredentials()
    expect(readOAuth1Credentials()).toEqual({
      consumerKey: "ck",
      consumerSecret: "cs",
      accessToken: "at",
      accessTokenSecret: "ats",
    })
  })

  it("rejects a partial set rather than half-signing a request", () => {
    withPublishCredentials()
    delete process.env.X_ACCESS_TOKEN_SECRET
    expect(readOAuth1Credentials()).toBeUndefined()
  })
})

// Reading and publishing are separate switches AND separate credentials.
// The pairing below is the one that must never silently post.
describe("reading live does not imply publishing live", () => {
  it("is a dry run when TWEET_PUBLISH is unset, even with a live source", () => {
    process.env.TWEET_SOURCE = "live"
    process.env.X_BEARER_TOKEN = "bearer-abc"
    withPublishCredentials()
    expect(isPublishLive()).toBe(false)
  })

  it("allows publishing only when the source is live too", () => {
    process.env.TWEET_PUBLISH = "live"
    withPublishCredentials()
    expect(publishBlockedReason(getTweetSource())).toMatch(/TWEET_SOURCE=live/)
  })

  it("blocks publishing when the user-context credentials are missing", () => {
    process.env.TWEET_SOURCE = "live"
    process.env.X_BEARER_TOKEN = "bearer-abc"
    process.env.TWEET_PUBLISH = "live"
    expect(publishBlockedReason(getTweetSource())).toMatch(/X_API_KEY/)
  })

  it("permits publishing when both switches and both credentials are set", () => {
    process.env.TWEET_SOURCE = "live"
    process.env.X_BEARER_TOKEN = "bearer-abc"
    process.env.TWEET_PUBLISH = "live"
    withPublishCredentials()
    expect(publishBlockedReason(getTweetSource())).toBeNull()
  })

  it("does not block a dry run for missing publish credentials", () => {
    expect(publishBlockedReason(getTweetSource())).toBeNull()
  })
})
