import { NextResponse } from "next/server"

import { requireCSR } from "@/lib/auth/session"
import { getTweetSource, TweetSourceConfigError } from "@/lib/social/source-factory"
import { scoreTweet } from "@/lib/social/urgency"
import {
  listKnownTweetHandles,
  recordAgentAction,
  upsertTweetMentions,
} from "@/lib/sqlite/queries"

const FETCH_LIMIT = 50

/**
 * Runs one fetch. Idempotent: `tweet_mentions.tweet_id` is unique, so a second
 * press inserts nothing.
 *
 * There is no scheduler — an admin presses the button (invariant 7).
 */
export async function POST() {
  const session = await requireCSR().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let source
  try {
    source = getTweetSource()
  } catch (error) {
    // A misconfigured live source fails loudly rather than quietly serving
    // fixtures while claiming to be live.
    if (error instanceof TweetSourceConfigError) {
      await recordAgentAction({ stage: "tweet_fetch", status: "failed", detail: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  const startedAt = new Date().toISOString()

  let tweets
  try {
    tweets = await source.fetchMentions({ limit: FETCH_LIMIT })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await recordAgentAction({
      stage: "tweet_fetch",
      status: "failed",
      detail: `${source.kind}: ${detail}`,
    })
    return NextResponse.json({ error: detail, source: source.kind }, { status: 502 })
  }

  // Handles already stored, so a returning complainant scores as a repeat.
  const knownHandles = await listKnownTweetHandles()

  // Scored oldest-first, adding each handle as we go, so a second post from
  // the same author *within this batch* is recognised as the repeat it is.
  // Scoring newest-first would let the repeat be processed before the post it
  // repeats, and the signal would be lost on every first fetch.
  const chronological = [...tweets].sort((a, b) => a.postedAt.localeCompare(b.postedAt))

  const rows = chronological.map((tweet) => {
    const score = scoreTweet(tweet, { knownHandles })
    knownHandles.add(tweet.authorHandle)
    return {
      id: `twm_${crypto.randomUUID()}`,
      tweetId: tweet.tweetId,
      authorHandle: tweet.authorHandle,
      authorName: tweet.authorName,
      text: tweet.text,
      postedAt: tweet.postedAt,
      permalink: tweet.permalink,
      replyCount: tweet.replyCount,
      likeCount: tweet.likeCount,
      fetchedAt: startedAt,
      isGrievance: score.isGrievance,
      urgency: score.urgency,
      urgencyReasons: JSON.stringify(score.reasons),
    }
  })

  const { inserted, skipped } = await upsertTweetMentions(rows)

  await recordAgentAction({
    stage: "tweet_fetch",
    status: "ok",
    detail: `${source.kind}: fetched ${tweets.length}, inserted ${inserted}, skipped ${skipped}`,
  })

  return NextResponse.json({
    source: source.kind,
    fetched: tweets.length,
    inserted,
    skipped,
  })
}
