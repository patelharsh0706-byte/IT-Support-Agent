// Ported from XActions `src/scrapers/twitter/http/actions.js` (`postTweet`,
// `replyToTweet`, `parseTweetResult`).
// Copyright (c) 2024-2026 nich (@nichxbt). Apache License 2.0 — see ./LICENSE.
//
// Changes: TypeScript port, and this is the ONLY write path kept. Upstream
// also exports `postTweet`, `postThread`, `deleteTweet`, `quoteTweet` and
// `schedulePost`.
//
// Upstream's `replyToTweet` is a thin wrapper over `postTweet`, so the
// CreateTweet mutation is necessarily still here — but this module exports
// exactly one function, and it always sets `reply.in_reply_to_tweet_id`.
// There is no exported path that posts a standalone tweet, quotes, deletes or
// schedules one. That is what invariant 5 requires of this codebase: not a
// promise never to call a capability, but the absence of the capability.

import { TwitterHttpClient } from "./client"
import { CREATE_TWEET } from "./endpoints"
import { TwitterApiError } from "./errors"

export const MAX_TWEET_LENGTH = 280

export interface PostedReply {
  replyTweetId: string
  permalink: string
}

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null
}

/** X nests the created tweet at varying depths depending on response shape. */
function parseCreatedTweet(json: unknown): { id: string; handle: string } | null {
  const data = asRecord(asRecord(json)?.data)
  const createTweet = asRecord(data?.create_tweet)
  const result =
    asRecord(asRecord(createTweet?.tweet_results)?.result) ??
    asRecord(asRecord(createTweet?.tweet_result)?.result)

  if (!result) return null
  const inner = asRecord(result.tweet) ?? result

  const id = inner.rest_id
  if (typeof id !== "string") return null

  const core = asRecord(asRecord(asRecord(inner.core)?.user_results)?.result)
  const handle =
    (asRecord(core?.core)?.screen_name as string | undefined) ??
    (asRecord(core?.legacy)?.screen_name as string | undefined) ??
    "i"

  return { id, handle }
}

/**
 * Post a public reply to one tweet. The only outbound capability in this
 * codebase.
 */
export async function replyToTweet(
  client: TwitterHttpClient,
  inReplyToTweetId: string,
  text: string,
): Promise<PostedReply> {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new TwitterApiError("Reply text must be a non-empty string")
  }
  if (text.length > MAX_TWEET_LENGTH) {
    throw new TwitterApiError(
      `Reply exceeds the platform limit (${text.length}/${MAX_TWEET_LENGTH})`,
    )
  }
  if (!inReplyToTweetId) {
    // Belt and braces: without this the mutation would post a standalone
    // tweet, which is precisely what this module must not be able to do.
    throw new TwitterApiError("A reply requires the tweet id it is replying to")
  }

  const variables = {
    tweet_text: text,
    dark_request: false,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: [],
    reply: {
      in_reply_to_tweet_id: inReplyToTweetId,
      exclude_reply_user_ids: [],
    },
  }

  const json = await client.mutate(CREATE_TWEET, variables)
  const created = parseCreatedTweet(json)
  if (!created) {
    throw new TwitterApiError("X accepted the reply but returned no tweet id")
  }

  return {
    replyTweetId: created.id,
    permalink: `https://x.com/${created.handle}/status/${created.id}`,
  }
}
