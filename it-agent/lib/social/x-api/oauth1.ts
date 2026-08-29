import { createHmac, randomBytes } from "node:crypto"

/**
 * OAuth 1.0a request signing (HMAC-SHA1), used for exactly one call: posting a
 * reply through `POST /2/tweets`.
 *
 * Reading and writing on X need *different* credentials, which is easy to miss
 * and expensive to discover at demo time:
 *
 * - **Reading** (`/2/tweets/search/recent`) is app-only. A single
 *   `X_BEARER_TOKEN` is enough.
 * - **Writing** acts as a user, so app-only auth is rejected. It needs the
 *   four-part OAuth 1.0a user-context credential — consumer key/secret plus
 *   the access token/secret of the account that will appear as the author.
 *
 * That asymmetry is why publishing stays a separate switch from reading
 * (`feature-specs/09-tweet-fetch-agent.md`): they are not merely different
 * levels of risk, they are different credentials.
 *
 * Implemented here rather than pulled in as a dependency because it is one
 * signature over one endpoint, and the whole algorithm is below.
 */

export interface OAuth1Credentials {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

/**
 * RFC 3986 percent-encoding. `encodeURIComponent` leaves `!*'()` alone, and
 * OAuth requires them escaped — a nonce or a reply containing an apostrophe
 * would otherwise produce a signature the server cannot reproduce.
 */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/** Ascending byte order, which is what RFC 5849 §3.4.1.3.2 means by "sorted". */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The signature base string: `METHOD&url&params`, with the parameters sorted
 * by encoded key then encoded value.
 *
 * The sort must be by code point, **not** `localeCompare` — ICU collation puts
 * `a` before `B`, byte order puts `B` first, and X reproduces the byte-order
 * base string. The two only diverge on mixed case, so a locale-aware sort
 * passes every lowercase test and then fails in production.
 *
 * Only query-string and `oauth_*` parameters go in. A JSON request body does
 * **not** — including it is the classic reason a hand-rolled signer returns
 * 401 on every call but works against form-encoded endpoints.
 *
 * Exported so it can be asserted directly: the base string is where signing
 * bugs actually live, and it is verifiable without knowing the secret.
 */
export function signatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const normalised = Object.entries(params)
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? byCodePoint(a[1], b[1]) : byCodePoint(a[0], b[0])))
    .map(([k, v]) => `${k}=${v}`)
    .join("&")

  return [method.toUpperCase(), percentEncode(url), percentEncode(normalised)].join("&")
}

interface AuthHeaderOptions {
  method: string
  /** Without a query string — any query parameters go in `queryParams`. */
  url: string
  queryParams?: Record<string, string>
  credentials: OAuth1Credentials
  /** Injectable so a test can assert an exact header. */
  nonce?: string
  timestamp?: number
}

/** Builds the `Authorization: OAuth …` header value for one request. */
export function buildAuthorizationHeader({
  method,
  url,
  queryParams = {},
  credentials,
  nonce = randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000),
}: AuthHeaderOptions): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  }

  const base = signatureBaseString(method, url, { ...queryParams, ...oauthParams })
  const signingKey = `${percentEncode(credentials.consumerSecret)}&${percentEncode(
    credentials.accessTokenSecret,
  )}`
  const signature = createHmac("sha1", signingKey).update(base).digest("base64")

  // Only the oauth_* parameters appear in the header; query parameters stay in
  // the URL where they already are.
  const header: Record<string, string> = { ...oauthParams, oauth_signature: signature }

  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(header[k])}"`)
    .join(", ")}`
}
