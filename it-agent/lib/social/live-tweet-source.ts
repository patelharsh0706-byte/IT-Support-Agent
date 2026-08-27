import { isPublishLive } from "./source-factory"
import type {
  FetchMentionsOptions,
  PublishedReply,
  RawTweet,
  ReplyOptions,
  TweetSource,
} from "./tweet-source"
import { TwitterHttpClient } from "./vendor/xactions/client"
import { replyToTweet } from "./vendor/xactions/reply"
import { buildMentionQuery, searchTweets } from "./vendor/xactions/search"

/** Handles whose mentions count as brand grievances. */
const BRAND_HANDLES = ["AmericanExpress", "AskAmex"]

export interface LiveTweetSourceOptions {
  authToken: string
  csrfToken: string
  brandHandles?: string[]
}

/**
 * The opt-in network source, reached only when `TWEET_SOURCE=live`.
 *
 * Reading and publishing are separate switches: this class fetches live as
 * soon as it is constructed, but `reply()` still returns a dry run unless
 * `TWEET_PUBLISH=live` is set independently. Reading someone's complaint and
 * posting under the brand's name are different levels of risk.
 */
export class LiveTweetSource implements TweetSource {
  readonly kind = "live" as const
  private readonly client: TwitterHttpClient
  private readonly brandHandles: string[]

  constructor(options: LiveTweetSourceOptions) {
    this.client = new TwitterHttpClient({
      authToken: options.authToken,
      csrfToken: options.csrfToken,
    })
    this.brandHandles = options.brandHandles ?? BRAND_HANDLES
  }

  async fetchMentions(opts: FetchMentionsOptions): Promise<RawTweet[]> {
    const query = buildMentionQuery(this.brandHandles)
    const tweets = await searchTweets(this.client, query, {
      limit: opts.limit,
      product: "Latest",
    })

    return tweets.map((t) => ({
      tweetId: t.tweetId,
      authorHandle: t.authorHandle,
      authorName: t.authorName,
      text: t.text,
      postedAt: t.postedAt,
      permalink: t.permalink,
      replyCount: t.replyCount,
      likeCount: t.likeCount,
    }))
  }

  async reply(opts: ReplyOptions): Promise<PublishedReply> {
    if (!isPublishLive()) {
      // Dry run: the whole flow ran, nothing reached a timeline. The UI says
      // so plainly — nobody should discover the difference by seeing their
      // test text appear publicly.
      const replyTweetId = `dryrun_${opts.inReplyToTweetId}_${Date.now()}`
      return {
        replyTweetId,
        permalink: `https://x.com/i/status/${replyTweetId}`,
        sentAt: new Date().toISOString(),
        isDryRun: true,
      }
    }

    const posted = await replyToTweet(this.client, opts.inReplyToTweetId, opts.text)
    return {
      replyTweetId: posted.replyTweetId,
      permalink: posted.permalink,
      sentAt: new Date().toISOString(),
      isDryRun: false,
    }
  }
}
