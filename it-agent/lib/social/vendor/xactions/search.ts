// Ported from XActions `src/scrapers/twitter/http/search.js` (`searchTweets`,
// and the advanced-query builder it inlines).
// Copyright (c) 2024-2026 nich (@nichxbt). Apache License 2.0 — see ./LICENSE.
//
// Changes: TypeScript port. Kept only tweet search — upstream also exports
// `searchUsers`, `scrapeTrending` and `scrapeHashtag`. Dropped the
// checkpoint/resume machinery and the progress callback; added a page cap so
// a request cannot page indefinitely.

import { TwitterHttpClient, pageDelay } from "./client"
import { SEARCH_TIMELINE } from "./endpoints"
import { parseTimelineInstructions, type ParsedTweet } from "./parsers"

export interface SearchOptions {
  limit?: number
  /** "Latest" is chronological; "Top" is ranked. Grievance triage wants Latest. */
  product?: "Latest" | "Top"
  /** Hard cap on pagination, independent of `limit`. */
  maxPages?: number
}

const PAGE_SIZE = 20
const DEFAULT_LIMIT = 50
const DEFAULT_MAX_PAGES = 5

/**
 * Builds X's advanced-search string. `-filter:retweets` matters here: a
 * retweeted complaint is the same grievance amplified, not a new one, and
 * without this the feed fills with duplicates the dedupe key would not catch.
 */
export function buildMentionQuery(handles: string[]): string {
  const mentions = handles.map((h) => `@${h.replace(/^@/, "")}`).join(" OR ")
  return `(${mentions}) -filter:retweets lang:en`
}

export async function searchTweets(
  client: TwitterHttpClient,
  query: string,
  options: SearchOptions = {},
): Promise<ParsedTweet[]> {
  const limit = options.limit ?? DEFAULT_LIMIT
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES
  const product = options.product ?? "Latest"

  const collected: ParsedTweet[] = []
  const seen = new Set<string>()
  let cursor: string | null = null

  for (let page = 0; page < maxPages && collected.length < limit; page += 1) {
    if (page > 0) await pageDelay()

    const variables: Record<string, unknown> = {
      rawQuery: query,
      count: PAGE_SIZE,
      querySource: "typed_query",
      product,
    }
    if (cursor) variables.cursor = cursor

    const response = (await client.query(SEARCH_TIMELINE, variables)) as {
      data?: {
        search_by_raw_query?: {
          search_timeline?: { timeline?: { instructions?: unknown } }
        }
      }
    }

    const instructions =
      response?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ?? []
    const { tweets, bottomCursor } = parseTimelineInstructions(instructions)

    for (const tweet of tweets) {
      if (collected.length >= limit) break
      // The same tweet can appear across pages when the timeline shifts
      // mid-pagination.
      if (seen.has(tweet.tweetId)) continue
      seen.add(tweet.tweetId)
      collected.push(tweet)
    }

    // No cursor, or a page that added nothing, means the timeline is exhausted.
    if (!bottomCursor || tweets.length === 0) break
    cursor = bottomCursor
  }

  return collected
}
