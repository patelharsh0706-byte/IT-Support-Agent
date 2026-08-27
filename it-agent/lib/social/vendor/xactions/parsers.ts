// Ported from XActions `src/scrapers/twitter/http/tweets.js`
// (`parseTweetData`, `parseTimelineInstructions`) and `profile.js`
// (`parseUserData`).
// Copyright (c) 2024-2026 nich (@nichxbt). Apache License 2.0 — see ./LICENSE.
//
// Changes: TypeScript port, narrowed to the handful of fields this app stores.
// Upstream parses the full tweet and user objects — entities, media, cards,
// note-tweets, community context — none of which we persist.

export interface ParsedTweet {
  tweetId: string
  authorHandle: string
  authorName: string
  text: string
  postedAt: string
  permalink: string
  replyCount: number
  likeCount: number
}

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/**
 * X serves `created_at` as "Wed Aug 27 09:15:02 +0000 2026". Anything that
 * does not parse degrades to now rather than throwing — one odd timestamp
 * should not lose an entire fetch.
 */
function toIso(raw: unknown): string {
  const value = str(raw)
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

/** One `tweet_results.result` node → the fields we keep. */
export function parseTweetData(result: unknown): ParsedTweet | null {
  const node = asRecord(result)
  if (!node) return null

  // Tweets with visibility limits nest the real payload one level deeper.
  const inner = asRecord(node.tweet) ?? node

  const tweetId = str(inner.rest_id)
  const legacy = asRecord(inner.legacy)
  if (!tweetId || !legacy) return null

  const userResult = asRecord(asRecord(asRecord(inner.core)?.user_results)?.result)
  const author = parseUserData(userResult)
  if (!author) return null

  const text = str(legacy.full_text) ?? str(legacy.text) ?? ""

  return {
    tweetId,
    authorHandle: author.handle,
    authorName: author.name,
    text,
    postedAt: toIso(legacy.created_at),
    permalink: `https://x.com/${author.handle}/status/${tweetId}`,
    replyCount: num(legacy.reply_count),
    likeCount: num(legacy.favorite_count),
  }
}

export interface ParsedUser {
  handle: string
  name: string
}

export function parseUserData(result: unknown): ParsedUser | null {
  const node = asRecord(result)
  if (!node) return null

  // Newer responses put these on `core`; older ones on `legacy`.
  const core = asRecord(node.core)
  const legacy = asRecord(node.legacy)

  const handle = str(core?.screen_name) ?? str(legacy?.screen_name)
  if (!handle) return null

  return { handle, name: str(core?.name) ?? str(legacy?.name) ?? handle }
}

export interface ParsedTimeline {
  tweets: ParsedTweet[]
  bottomCursor: string | null
}

/**
 * Walks the timeline instruction list, which mixes entry kinds: individual
 * tweets, conversation modules, and cursors.
 */
export function parseTimelineInstructions(instructions: unknown): ParsedTimeline {
  const tweets: ParsedTweet[] = []
  let bottomCursor: string | null = null

  if (!Array.isArray(instructions)) return { tweets, bottomCursor }

  for (const instruction of instructions) {
    const entries = asRecord(instruction)?.entries
    if (!Array.isArray(entries)) continue

    for (const entry of entries) {
      const entryRecord = asRecord(entry)
      const content = asRecord(entryRecord?.content)
      if (!content) continue

      const cursorType = str(content.cursorType)
      if (cursorType === "Bottom") {
        bottomCursor = str(content.value)
        continue
      }

      const direct = asRecord(asRecord(content.itemContent)?.tweet_results)?.result
      const parsed = parseTweetData(direct)
      if (parsed) {
        tweets.push(parsed)
        continue
      }

      // Conversation modules carry several tweets under `items`.
      const items = content.items
      if (!Array.isArray(items)) continue
      for (const item of items) {
        const nested = asRecord(
          asRecord(asRecord(asRecord(item)?.item)?.itemContent)?.tweet_results,
        )?.result
        const nestedParsed = parseTweetData(nested)
        if (nestedParsed) tweets.push(nestedParsed)
      }
    }
  }

  return { tweets, bottomCursor }
}
