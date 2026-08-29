import { FixtureTweetSource } from "./fixture-tweet-source"
import type { TweetSource } from "./tweet-source"
import { XApiTweetSource } from "./x-api-tweet-source"
import type { OAuth1Credentials } from "./x-api/oauth1"

export class TweetSourceConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TweetSourceConfigError"
  }
}

/**
 * Whose mentions this agent watches. Overridable so the same build can be
 * pointed at a test account instead of the brand.
 *
 * `-is:retweet` matters: without it one complaint retweeted forty times
 * arrives as forty mentions, and the repeat-complainant signal in
 * `scoreTweet()` reads them as forty separate grievances.
 */
export const DEFAULT_SEARCH_QUERY =
  '(@AmericanExpress OR @Amex OR "American Express") -is:retweet -is:reply lang:en'

function readSearchQuery(): string {
  const configured = process.env.X_SEARCH_QUERY?.trim()
  return configured && configured.length > 0 ? configured : DEFAULT_SEARCH_QUERY
}

/**
 * The four-part user-context credential, or `undefined` when publishing is not
 * configured. All four or none — a partial set is a misconfiguration that
 * would otherwise surface as a 401 at the moment a CSR presses Post.
 */
export function readOAuth1Credentials(): OAuth1Credentials | undefined {
  const consumerKey = process.env.X_API_KEY
  const consumerSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) return undefined
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret }
}

/**
 * Fixture by default; `TWEET_SOURCE=live` reads real mentions through the X
 * API v2 using `X_BEARER_TOKEN`.
 *
 * A live source with a missing key **throws** rather than silently serving
 * fixtures — a demo quietly showing canned tweets while claiming to be live is
 * worse than one that errors.
 *
 * `TweetSource` is the seam, so nothing downstream — scoring, storage, the
 * board — knows which implementation produced its data.
 */
export function getTweetSource(): TweetSource {
  if (process.env.TWEET_SOURCE !== "live") {
    return new FixtureTweetSource()
  }

  const bearerToken = process.env.X_BEARER_TOKEN?.trim()
  if (!bearerToken) {
    throw new TweetSourceConfigError(
      "TWEET_SOURCE=live is set but X_BEARER_TOKEN is empty. Reading mentions needs the " +
        "app-only bearer token from the X developer portal. Unset TWEET_SOURCE to use the " +
        "fixture corpus.",
    )
  }

  return new XApiTweetSource({
    bearerToken,
    searchQuery: readSearchQuery(),
    oauth1: readOAuth1Credentials(),
  })
}

/**
 * Publishing is a separate switch from reading, and on X they are separate
 * *credentials*: reading is app-only, posting acts as a user. Dry run is the
 * default, so nothing reaches a real timeline by accident.
 */
export function isPublishLive(): boolean {
  return process.env.TWEET_PUBLISH === "live"
}

/**
 * Why publishing is unavailable, or `null` when it is ready. Checked before a
 * reply is written rather than after, so a CSR is told the credentials are
 * missing instead of watching a queued reply fail.
 */
export function publishBlockedReason(source: TweetSource): string | null {
  if (!isPublishLive()) return null
  if (source.kind !== "live") {
    return "TWEET_PUBLISH=live requires TWEET_SOURCE=live — a reply can only be posted to a mention that was really fetched."
  }
  if (!readOAuth1Credentials()) {
    return "TWEET_PUBLISH=live is set but the user-context credentials are incomplete. Posting acts as a user, so the app-only bearer is not enough: set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET."
  }
  return null
}
