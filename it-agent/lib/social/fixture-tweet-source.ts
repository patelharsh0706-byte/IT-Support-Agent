import { dryRunReply } from "./dry-run-reply"
import corpus from "./fixtures/brand-mentions.json"
import type {
  FetchMentionsOptions,
  PublishedReply,
  RawTweet,
  ReplyOptions,
  TweetSource,
} from "./tweet-source"

interface FixtureMention {
  tweetId: string
  authorHandle: string
  authorName: string
  text: string
  minutesAgo: number
  replyCount: number
  likeCount: number
}

/**
 * The default source. Reads the committed corpus and never touches the
 * network, so the whole flow — fetch, score, reply — works offline.
 *
 * Ordering is deterministic across runs. Timestamps are derived from
 * `minutesAgo` at call time rather than stored absolute, so the corpus never
 * ages out of the 6/12/24-hour windows the board filters by.
 */
export class FixtureTweetSource implements TweetSource {
  readonly kind = "fixture" as const

  async fetchMentions(opts: FetchMentionsOptions): Promise<RawTweet[]> {
    const now = Date.now()
    const mentions = corpus.mentions as FixtureMention[]

    const tweets: RawTweet[] = mentions.map((m) => ({
      tweetId: m.tweetId,
      authorHandle: m.authorHandle,
      authorName: m.authorName,
      text: m.text,
      postedAt: new Date(now - m.minutesAgo * 60_000).toISOString(),
      permalink: `https://x.com/${m.authorHandle}/status/${m.tweetId}`,
      replyCount: m.replyCount,
      likeCount: m.likeCount,
    }))

    // Newest first, then by id so two mentions a minute apart never swap
    // between renders.
    tweets.sort(
      (a, b) => b.postedAt.localeCompare(a.postedAt) || a.tweetId.localeCompare(b.tweetId)
    )

    return tweets.slice(0, opts.limit)
  }

  /**
   * Records the attempt and returns a synthetic id. The full reply flow runs
   * — guard, confirm, persisted row — and nothing leaves the machine.
   */
  async reply(opts: ReplyOptions): Promise<PublishedReply> {
    return dryRunReply(opts)
  }
}
