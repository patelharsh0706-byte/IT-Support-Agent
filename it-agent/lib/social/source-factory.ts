import { FixtureTweetSource } from "./fixture-tweet-source"
import type { TweetSource } from "./tweet-source"

export class TweetSourceConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TweetSourceConfigError"
  }
}

/**
 * Returns the fixture source. `TWEET_SOURCE=live` **throws** rather than
 * silently serving fixtures — a demo quietly showing canned tweets while
 * claiming to be live is worse than one that errors.
 *
 * There is no live implementation in the tree. It was removed on 2026-08-28:
 * the only viable route was X's internal GraphQL API, and X enforces a
 * per-request `x-client-transaction-id` derived from page state that a server
 * cannot generate — omitting it returns 404, replaying a captured one returns
 * 403. Verified against a real logged-in session; the bearer token, session
 * cookies and query ids were all correct and it still failed. See
 * `feature-specs/09-tweet-fetch-agent.md`.
 *
 * `TweetSource` remains the seam: a live adapter drops in here without any
 * other change if the blocker is ever solved, or if the fetch is moved into a
 * real browser.
 */
export function getTweetSource(): TweetSource {
  if (process.env.TWEET_SOURCE === "live") {
    throw new TweetSourceConfigError(
      "TWEET_SOURCE=live is set, but no live tweet source exists in this build. " +
        "X requires a per-request x-client-transaction-id that a server cannot " +
        "generate. Unset TWEET_SOURCE to use the fixture corpus.",
    )
  }

  return new FixtureTweetSource()
}

/**
 * Publishing is a separate switch from reading — they are different levels
 * of risk and must be enabled independently. Dry run is the default, so
 * nothing reaches a real timeline by accident.
 */
export function isPublishLive(): boolean {
  return process.env.TWEET_PUBLISH === "live"
}
