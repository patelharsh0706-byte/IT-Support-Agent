import type { tweetMentions, tweetReplies } from "@/lib/sqlite/schema"

export type TweetMentionRow = typeof tweetMentions.$inferSelect
export type TweetReplyRow = typeof tweetReplies.$inferSelect

export type Urgency = "critical" | "high" | "normal"

/** The 6/12/24-hour windows the board filters by, in hours. */
export const TWEET_WINDOWS = [6, 12, 24] as const
export type TweetWindow = (typeof TWEET_WINDOWS)[number]

export function isTweetWindow(value: unknown): value is TweetWindow {
  return TWEET_WINDOWS.includes(Number(value) as TweetWindow)
}

/**
 * A mention with its outbound attempts, which is what a feed row renders.
 * `urgencyReasons` is stored as a JSON string and parsed here so no
 * component has to know that.
 */
export interface TweetMentionView extends Omit<TweetMentionRow, "urgencyReasons"> {
  urgencyReasons: string[]
  replies: TweetReplyRow[]
}

export interface TweetFeedFilters {
  window?: TweetWindow
  urgency?: Urgency
  grievanceOnly?: boolean
  includeDismissed?: boolean
  unrepliedOnly?: boolean
}
