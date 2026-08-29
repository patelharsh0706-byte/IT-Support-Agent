import { afterEach, describe, expect, it, vi } from "vitest"

import { XApiError, XApiTweetSource } from "./x-api-tweet-source"

const CONFIG = { bearerToken: "bearer-abc", searchQuery: "@Amex -is:retweet" }

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stubFetch(response: Response) {
  const spy = vi.fn(async () => response)
  vi.stubGlobal("fetch", spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

const SEARCH_BODY = {
  data: [
    {
      id: "1001",
      text: "@Amex my card is blocked and nobody has replied",
      created_at: "2026-08-29T09:30:00.000Z",
      author_id: "u1",
      public_metrics: { reply_count: 3, like_count: 12 },
    },
  ],
  includes: { users: [{ id: "u1", name: "Dana Marcus", username: "danamarcus" }] },
}

describe("fetchMentions builds the request X expects", () => {
  it("sends the bearer token and asks for the fields the board needs", async () => {
    const spy = stubFetch(respond(200, SEARCH_BODY))
    await new XApiTweetSource(CONFIG).fetchMentions({ limit: 50 })

    const [url, init] = spy.mock.calls[0] as unknown as [URL, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer bearer-abc")
    expect(url.searchParams.get("query")).toBe("@Amex -is:retweet")
    // created_at is not returned by default; without it every mention would
    // land in the wrong 6/12/24-hour window.
    expect(url.searchParams.get("tweet.fields")).toContain("created_at")
    expect(url.searchParams.get("expansions")).toBe("author_id")
  })

  it("clamps max_results into the 10–100 range recent search accepts", async () => {
    const spy = stubFetch(respond(200, SEARCH_BODY))
    await new XApiTweetSource(CONFIG).fetchMentions({ limit: 500 })
    expect((spy.mock.calls[0] as unknown as [URL])[0].searchParams.get("max_results")).toBe("100")

    stubFetch(respond(200, SEARCH_BODY))
    const spy2 = vi.mocked(globalThis.fetch)
    await new XApiTweetSource(CONFIG).fetchMentions({ limit: 2 })
    expect((spy2.mock.calls[0] as unknown as [URL])[0].searchParams.get("max_results")).toBe("10")
  })

  it("passes since_id only when given one", async () => {
    const spy = stubFetch(respond(200, SEARCH_BODY))
    await new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })
    expect((spy.mock.calls[0] as unknown as [URL])[0].searchParams.has("since_id")).toBe(false)
  })
})

describe("fetchMentions normalises into RawTweet", () => {
  it("joins author_id to includes.users for the handle", async () => {
    stubFetch(respond(200, SEARCH_BODY))
    const [tweet] = await new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })

    expect(tweet).toEqual({
      tweetId: "1001",
      authorHandle: "danamarcus",
      authorName: "Dana Marcus",
      text: "@Amex my card is blocked and nobody has replied",
      postedAt: "2026-08-29T09:30:00.000Z",
      permalink: "https://x.com/danamarcus/status/1001",
      replyCount: 3,
      likeCount: 12,
    })
  })

  it("returns an empty list when a search matches nothing", async () => {
    // No matches omits `data` entirely rather than sending [].
    stubFetch(respond(200, { meta: { result_count: 0 } }))
    expect(await new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })).toEqual([])
  })

  it("defaults missing public_metrics to zero rather than NaN", async () => {
    stubFetch(
      respond(200, {
        data: [{ id: "1", text: "hi", created_at: "2026-08-29T09:00:00Z", author_id: "u1" }],
        includes: { users: [{ id: "u1", name: "N", username: "n" }] },
      }),
    )
    const [tweet] = await new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })
    expect(tweet.replyCount).toBe(0)
    expect(tweet.likeCount).toBe(0)
  })

  it("fails rather than dating an undated tweet as fresh", async () => {
    stubFetch(respond(200, { data: [{ id: "1", text: "hi", author_id: "u1" }] }))
    await expect(new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })).rejects.toThrow(
      /created_at/,
    )
  })
})

describe("failures say what to do about them", () => {
  it("names the token on 401", async () => {
    stubFetch(respond(401, { title: "Unauthorized" }))
    await expect(new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })).rejects.toThrow(
      /X_BEARER_TOKEN/,
    )
  })

  it("names the plan limit on 403, which is the likeliest cause", async () => {
    stubFetch(respond(403, { detail: "not permitted" }))
    await expect(new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })).rejects.toThrow(
      /Basic tier/,
    )
  })

  it("reports a rate limit as a rate limit", async () => {
    stubFetch(respond(429, {}))
    await expect(new XApiTweetSource(CONFIG).fetchMentions({ limit: 20 })).rejects.toThrow(/429/)
  })
})

describe("reply", () => {
  it("refuses without user-context credentials instead of trying the bearer", async () => {
    const spy = stubFetch(respond(201, { data: { id: "9" } }))
    await expect(
      new XApiTweetSource(CONFIG).reply({ inReplyToTweetId: "1001", text: "hi" }),
    ).rejects.toThrow(/X_ACCESS_TOKEN/)
    // The point: no request was attempted.
    expect(spy).not.toHaveBeenCalled()
  })

  it("posts a threaded reply signed with OAuth 1.0a", async () => {
    const spy = stubFetch(respond(201, { data: { id: "9001" } }))
    const source = new XApiTweetSource({
      ...CONFIG,
      oauth1: {
        consumerKey: "ck",
        consumerSecret: "cs",
        accessToken: "at",
        accessTokenSecret: "ats",
      },
    })

    const published = await source.reply({ inReplyToTweetId: "1001", text: "We can help." })

    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toMatch(/^OAuth /)
    expect(JSON.parse(init.body as string)).toEqual({
      text: "We can help.",
      reply: { in_reply_to_tweet_id: "1001" },
    })
    expect(published.replyTweetId).toBe("9001")
    expect(published.isDryRun).toBe(false)
  })

  it("does not report success when X returns no id", async () => {
    stubFetch(respond(201, { data: {} }))
    const source = new XApiTweetSource({
      ...CONFIG,
      oauth1: { consumerKey: "ck", consumerSecret: "cs", accessToken: "at", accessTokenSecret: "ats" },
    })
    await expect(source.reply({ inReplyToTweetId: "1", text: "hi" })).rejects.toBeInstanceOf(
      XApiError,
    )
  })
})
