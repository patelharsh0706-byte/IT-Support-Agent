import { NextRequest, NextResponse } from "next/server"

import { requireCSR } from "@/lib/auth/session"
import { setTweetMentionDismissed } from "@/lib/sqlite/queries"

type RouteParams = { params: Promise<{ tweetId: string }> }

/**
 * Dismiss or restore a mention. Reversible, and the row is never deleted —
 * "what did the agent see and reject" stays answerable.
 *
 * Dismissing needs no confirmation; posting to X does.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireCSR().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tweetId } = await params
  const body = await request.json().catch(() => ({}))
  if (typeof body.dismissed !== "boolean") {
    return NextResponse.json({ error: "dismissed must be a boolean" }, { status: 400 })
  }

  const mention = await setTweetMentionDismissed(tweetId, body.dismissed)
  if (!mention) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ mention })
}
