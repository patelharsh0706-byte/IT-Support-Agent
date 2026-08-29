import { NextRequest, NextResponse } from "next/server"

import { requireCsrName } from "@/lib/auth/session"
import { checkReply } from "@/lib/social/reply-guard"
import { dryRunReply } from "@/lib/social/dry-run-reply"
import {
  getTweetSource,
  isPublishLive,
  publishBlockedReason,
  TweetSourceConfigError,
} from "@/lib/social/source-factory"
import {
  createPendingReply,
  getTweetMentionByTweetId,
  hasPendingReply,
  markReplyFailed,
  markReplySent,
  recordAgentAction,
} from "@/lib/sqlite/queries"

type RouteParams = { params: Promise<{ tweetId: string }> }

/**
 * Publishes one public reply. Every outbound post originates here, and this
 * route resolves a CSR identity from the session before anything else —
 * there is no path to the publish function that skips it (invariant 5).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const csrName = await requireCsrName().catch(() => null)
  if (!csrName) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tweetId } = await params
  const mention = await getTweetMentionByTweetId(tweetId)
  if (!mention) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === "string" ? body.text : ""

  const guard = checkReply(text)
  if (!guard.ok) {
    // Blocked before any publish call, and the matched rules are returned so
    // the admin can fix it rather than guess.
    await recordAgentAction({
      stage: "tweet_reply",
      status: "denied",
      detail: `guard: ${guard.violations.map((v) => v.rule).join(", ")}`,
      tweetMentionId: mention.id,
    })
    return NextResponse.json({ error: "Blocked by reply guard", violations: guard.violations }, { status: 422 })
  }

  // A double-click must not double-post.
  if (await hasPendingReply(mention.id)) {
    return NextResponse.json(
      { error: "A reply to this mention is already in flight" },
      { status: 409 },
    )
  }

  let source
  try {
    source = getTweetSource()
  } catch (error) {
    if (error instanceof TweetSourceConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  // Refused before a row is written, so a CSR is told the publish credentials
  // are incomplete rather than watching a queued reply fail.
  const blocked = publishBlockedReason(source)
  if (blocked) {
    await recordAgentAction({
      stage: "tweet_reply",
      status: "failed",
      detail: blocked,
      tweetMentionId: mention.id,
    })
    return NextResponse.json({ error: blocked }, { status: 500 })
  }

  const dryRun = source.kind === "fixture" || !isPublishLive()

  // Written BEFORE the publish call, so a crash mid-send leaves evidence
  // rather than a gap.
  const pending = await createPendingReply({
    tweetMentionId: mention.id,
    text: text.trim(),
    sentByCsrName: csrName,
    isDryRun: dryRun,
  })

  try {
    // A dry run must not reach the live client at all. `TWEET_SOURCE=live`
    // with `TWEET_PUBLISH` unset means read real mentions, post nothing —
    // calling `source.reply()` here would post for real while the stored row
    // claimed a dry run.
    const published = dryRun
      ? dryRunReply({ inReplyToTweetId: mention.tweetId, text: text.trim() })
      : await source.reply({
          inReplyToTweetId: mention.tweetId,
          text: text.trim(),
        })

    const sent = await markReplySent(pending.id, {
      platformReplyId: published.replyTweetId,
      platformPermalink: published.permalink,
      sentAt: published.sentAt,
    })

    await recordAgentAction({
      stage: "tweet_reply",
      status: "ok",
      detail: `${published.isDryRun ? "dry run" : "published"} by ${csrName} → ${published.permalink}`,
      tweetMentionId: mention.id,
    })

    return NextResponse.json({ reply: sent, isDryRun: published.isDryRun }, { status: 201 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const failed = await markReplyFailed(pending.id, detail)
    await recordAgentAction({
      stage: "tweet_reply",
      status: "failed",
      detail,
      tweetMentionId: mention.id,
    })
    return NextResponse.json({ error: detail, reply: failed }, { status: 502 })
  }
}
