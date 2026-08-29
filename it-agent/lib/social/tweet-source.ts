/**
 * One interface, two implementations — nothing downstream knows which
 * produced its data. See `feature-specs/09-tweet-fetch-agent.md`.
 */

/** A mention as the platform gives it, normalised. */
export interface RawTweet {
  tweetId: string
  authorHandle: string
  authorName: string
  text: string
  /** ISO 8601. The tweet's own timestamp, never ingest time. */
  postedAt: string
  permalink: string
  replyCount: number
  likeCount: number
}

export interface PublishedReply {
  replyTweetId: string
  permalink: string
  /** ISO 8601. */
  sentAt: string
  /**
   * True when this never reached a real timeline. The UI says so plainly —
   * nobody should discover the difference by seeing test text appear
   * publicly.
   */
  isDryRun: boolean
}

export interface FetchMentionsOptions {
  /** Only mentions newer than this platform id, when the source supports it. */
  sinceId?: string
  limit: number
}

export interface ReplyOptions {
  inReplyToTweetId: string
  text: string
}

export interface TweetSource {
  readonly kind: "fixture" | "live"
  fetchMentions(opts: FetchMentionsOptions): Promise<RawTweet[]>
  reply(opts: ReplyOptions): Promise<PublishedReply>
}
