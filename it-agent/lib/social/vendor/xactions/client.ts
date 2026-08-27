// Ported from XActions `src/scrapers/twitter/http/client.js`
// (`TwitterHttpClient`, `_buildHeaders`, `graphql`, `_graphqlOnce`).
// Copyright (c) 2024-2026 nich (@nichxbt). Apache License 2.0 — see ./LICENSE.
//
// Changes: TypeScript port. Dropped the account pool, Puppeteer/Playwright
// session acquisition, checkpoint/resume, the retry ladder, and the live
// query-id auto-refresh. Rate limiting is a fixed inter-page delay plus a hard
// overall timeout, because this runs inside a request that must not hang a
// console.

import {
  BEARER_TOKEN,
  DEFAULT_FEATURES,
  GRAPHQL_BASE,
  buildGraphQLUrl,
  type GraphQLOperation,
} from "./endpoints"
import { AuthError, RateLimitError, TwitterApiError } from "./errors"

export interface TwitterHttpClientOptions {
  /** The `auth_token` cookie from a logged-in session. */
  authToken: string
  /** The `ct0` cookie, which is also the CSRF header value. */
  csrfToken: string
  /** Hard ceiling for any single request. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

export class TwitterHttpClient {
  private readonly authToken: string
  private readonly csrfToken: string
  private readonly timeoutMs: number

  constructor(options: TwitterHttpClientOptions) {
    this.authToken = options.authToken
    this.csrfToken = options.csrfToken
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private buildHeaders(): Record<string, string> {
    return {
      authorization: `Bearer ${decodeURIComponent(BEARER_TOKEN)}`,
      "user-agent": USER_AGENT,
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
      "x-csrf-token": this.csrfToken,
      "x-twitter-auth-type": "OAuth2Session",
      cookie: `auth_token=${this.authToken}; ct0=${this.csrfToken}`,
    }
  }

  private async request(url: string, init: RequestInit = {}): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        headers: { ...this.buildHeaders(), ...(init.headers as Record<string, string>) },
        signal: controller.signal,
        cache: "no-store",
      })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TwitterApiError(`Request timed out after ${this.timeoutMs}ms`)
      }
      throw new TwitterApiError(
        `Network failure calling X: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        `X rejected the session (${response.status}). The auth_token/ct0 pair is likely expired.`,
      )
    }
    if (response.status === 429) {
      throw new RateLimitError("X rate-limited this session. Wait before fetching again.")
    }
    if (!response.ok) {
      throw new TwitterApiError(`X returned ${response.status}`, response.status)
    }

    const json = (await response.json()) as { errors?: { message?: string }[] }
    // GraphQL reports failures in the body with a 200, including the stale
    // query-id case. Upstream self-heals by re-scraping x.com's bundles; we
    // pin ids instead, so this surfaces loudly.
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      throw new TwitterApiError(
        `X GraphQL error: ${json.errors.map((e) => e?.message ?? "unknown").join("; ")}`,
      )
    }
    return json
  }

  /** A read query — variables go in the URL. */
  async query(op: GraphQLOperation, variables: Record<string, unknown>): Promise<unknown> {
    return this.request(buildGraphQLUrl(op, variables))
  }

  /** A mutation — variables go in the body, and there is no pagination. */
  async mutate(op: GraphQLOperation, variables: Record<string, unknown>): Promise<unknown> {
    return this.request(`${GRAPHQL_BASE}/${op.queryId}/${op.operationName}`, {
      method: "POST",
      body: JSON.stringify({
        variables,
        features: DEFAULT_FEATURES,
        queryId: op.queryId,
      }),
    })
  }
}

/** Upstream's human-like pacing, kept: 1–3s between pages. */
export function pageDelay(): Promise<void> {
  const ms = 1000 + Math.random() * 2000
  return new Promise((resolve) => setTimeout(resolve, ms))
}
