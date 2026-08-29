import { buildAuthorizationHeader, type OAuth1Credentials } from "./x-api/oauth1"
import type {
  FetchMentionsOptions,
  PublishedReply,
  RawTweet,
  ReplyOptions,
  TweetSource,
} from "./tweet-source"

/**
 * The live source: X API v2, official and keyed.
 *
 * This replaces the scraped-GraphQL route that was removed on 2026-08-28 —
 * that path is blocked by a per-request `x-client-transaction-id` derived from
 * page state, which a server cannot generate. The keyed API has no such
 * problem; it just costs money.
 *
 * **Recent search is not on the free tier.** A free key returns 403 on
 * `/2/tweets/search/recent` no matter how valid it is. That is a plan limit,
 * not a bug, and the error below says so rather than leaving someone to
 * re-check their token. See `feature-specs/09-tweet-fetch-agent.md`.
 */

const API_BASE = "https://api.x.com/2"

/** Recent search accepts 10–100; anything outside is a 400. */
const MIN_RESULTS = 10
const MAX_RESULTS = 100

export class XApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "XApiError"
    this.status = status
  }
}

export interface XApiConfig {
  /** App-only OAuth 2.0 bearer. Reads only — it cannot post. */
  bearerToken: string
  /** The search query. Whose mentions this agent is watching. */
  searchQuery: string
  /** Present only when publishing is configured; reading does not need it. */
  oauth1?: OAuth1Credentials
}

interface SearchResponseTweet {
  id: string
  text: string
  created_at?: string
  author_id?: string
  public_metrics?: { reply_count?: number; like_count?: number }
}

interface SearchResponseUser {
  id: string
  name: string
  username: string
}

interface SearchResponse {
  data?: SearchResponseTweet[]
  includes?: { users?: SearchResponseUser[] }
  errors?: { message?: string; detail?: string; title?: string }[]
  title?: string
  detail?: string
}

/**
 * Turns an X error response into one sentence a CSR can act on. The raw body
 * is JSON with the useful part in one of three different places depending on
 * which layer rejected the call.
 */
function describeFailure(status: number, body: unknown): string {
  const b = body as SearchResponse | null
  const fromArray = b?.errors?.[0]
  const detail = fromArray?.detail ?? fromArray?.message ?? b?.detail ?? b?.title

  if (status === 401) {
    return "X rejected the credentials (401). Check X_BEARER_TOKEN — it is the app-only bearer from the developer portal, not an access token."
  }
  if (status === 403) {
    return `X refused the request (403). Recent search requires a Basic tier project or above; a free-tier key cannot call it.${detail ? ` X said: ${detail}` : ""}`
  }
  if (status === 429) {
    return "X rate limit reached (429). Wait for the window to reset before fetching again."
  }
  return `X returned ${status}${detail ? `: ${detail}` : ""}`
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export class XApiTweetSource implements TweetSource {
  readonly kind = "live" as const

  constructor(private readonly config: XApiConfig) {}

  async fetchMentions(opts: FetchMentionsOptions): Promise<RawTweet[]> {
    const url = new URL(`${API_BASE}/tweets/search/recent`)
    url.searchParams.set("query", this.config.searchQuery)
    url.searchParams.set(
      "max_results",
      String(Math.min(MAX_RESULTS, Math.max(MIN_RESULTS, opts.limit))),
    )
    // created_at is not returned by default, and without it every mention
    // would land in the wrong 6/12/24-hour window.
    url.searchParams.set("tweet.fields", "created_at,public_metrics")
    url.searchParams.set("expansions", "author_id")
    url.searchParams.set("user.fields", "username,name")
    if (opts.sinceId) url.searchParams.set("since_id", opts.sinceId)

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${this.config.bearerToken}` },
      cache: "no-store",
    })

    const body = await readJson(response)
    if (!response.ok) {
      throw new XApiError(response.status, describeFailure(response.status, body))
    }

    const payload = body as SearchResponse
    // A search with no matches omits `data` entirely rather than sending [].
    const tweets = payload.data ?? []

    // author_id is a foreign key into `includes.users`; the handle is never
    // inlined on the tweet itself.
    const users = new Map((payload.includes?.users ?? []).map((u) => [u.id, u]))

    return tweets.map((t) => {
      const author = t.author_id ? users.get(t.author_id) : undefined
      const handle = author?.username ?? "unknown"
      return {
        tweetId: t.id,
        authorHandle: handle,
        authorName: author?.name ?? handle,
        text: t.text,
        // Falling back to now would date an old mention as fresh and push it
        // to the top of the board, so an absent timestamp is a hard failure.
        postedAt: new Date(
          t.created_at ??
            (() => {
              throw new XApiError(502, `Tweet ${t.id} came back without created_at`)
            })(),
        ).toISOString(),
        permalink: `https://x.com/${handle}/status/${t.id}`,
        replyCount: t.public_metrics?.reply_count ?? 0,
        likeCount: t.public_metrics?.like_count ?? 0,
      }
    })
  }

  async reply(opts: ReplyOptions): Promise<PublishedReply> {
    const credentials = this.config.oauth1
    if (!credentials) {
      throw new XApiError(
        400,
        "Publishing is not configured. Posting acts as a user, so the app-only bearer cannot do it — set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET.",
      )
    }

    const url = `${API_BASE}/tweets`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        // The JSON body is deliberately absent from the signature; only the
        // oauth_* parameters are signed. See `x-api/oauth1.ts`.
        authorization: buildAuthorizationHeader({ method: "POST", url, credentials }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: opts.text,
        reply: { in_reply_to_tweet_id: opts.inReplyToTweetId },
      }),
      cache: "no-store",
    })

    const body = await readJson(response)
    if (!response.ok) {
      throw new XApiError(response.status, describeFailure(response.status, body))
    }

    const id = (body as { data?: { id?: string } }).data?.id
    if (!id) throw new XApiError(502, "X accepted the reply but returned no tweet id")

    return {
      replyTweetId: id,
      // The authoring handle is not in the response, and /i/web/status resolves
      // without it.
      permalink: `https://x.com/i/web/status/${id}`,
      sentAt: new Date().toISOString(),
      isDryRun: false,
    }
  }
}
