import type { PublishedReply, ReplyOptions } from "./tweet-source"

/**
 * The reply that never leaves the machine.
 *
 * It lives outside any `TweetSource` because a dry run must be possible even
 * when the source is live: `TWEET_SOURCE=live` with `TWEET_PUBLISH` unset
 * means *read real mentions, post nothing*, and the only way to honour that is
 * to not call the live client at all.
 */
export function dryRunReply(opts: ReplyOptions): PublishedReply {
  const replyTweetId = `dryrun_reply_${opts.inReplyToTweetId}_${Date.now()}`
  return {
    replyTweetId,
    permalink: `https://x.com/i/status/${replyTweetId}`,
    sentAt: new Date().toISOString(),
    isDryRun: true,
  }
}
