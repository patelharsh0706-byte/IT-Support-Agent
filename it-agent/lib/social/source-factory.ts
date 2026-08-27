import { FixtureTweetSource } from "./fixture-tweet-source"
import { LiveTweetSource } from "./live-tweet-source"
import type { TweetSource } from "./tweet-source"

export class TweetSourceConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TweetSourceConfigError"
  }
}

/**
 * `TWEET_SOURCE=live` opts into the network; anything else uses fixtures.
 *
 * When `live` is set and the credential is missing this **throws at the call
 * site**. It must never silently fall back to fixtures: a demo quietly
 * showing canned tweets while claiming to be live is worse than one that
 * errors.
 */
export function getTweetSource(): TweetSource {
  if (process.env.TWEET_SOURCE !== "live") {
    return new FixtureTweetSource()
  }

  const authToken = process.env.X_AUTH_TOKEN
  const csrfToken = process.env.X_CSRF_TOKEN
  if (!authToken || !csrfToken) {
    throw new TweetSourceConfigError(
      "TWEET_SOURCE=live requires X_AUTH_TOKEN and X_CSRF_TOKEN. " +
        "Set them in .env.local or unset TWEET_SOURCE to use the fixture corpus. " +
        "Refusing to fall back silently.",
    )
  }

  return new LiveTweetSource({ authToken, csrfToken })
}

/**
 * Publishing is a separate switch from reading — they are different levels
 * of risk and must be enabled independently. Dry run is the default, so
 * nothing reaches a real timeline by accident.
 */
export function isPublishLive(): boolean {
  return process.env.TWEET_PUBLISH === "live"
}
