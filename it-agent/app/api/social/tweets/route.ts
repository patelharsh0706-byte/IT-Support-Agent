import { NextRequest, NextResponse } from "next/server"

import { requireCSR } from "@/lib/auth/session"
import { isTweetWindow } from "@/lib/social/types"
import { listTweetMentions } from "@/lib/sqlite/queries"

/** The feed. CSR-only, like every route in this unit. */
export async function GET(request: NextRequest) {
  const session = await requireCSR().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const windowParam = params.get("window")
  const urgency = params.get("urgency")

  const mentions = await listTweetMentions({
    windowHours: isTweetWindow(windowParam) ? Number(windowParam) : undefined,
    urgency:
      urgency === "critical" || urgency === "high" || urgency === "normal" ? urgency : undefined,
    grievanceOnly: params.get("grievanceOnly") === "true",
    includeDismissed: params.get("includeDismissed") === "true",
    unrepliedOnly: params.get("unrepliedOnly") === "true",
  })

  return NextResponse.json({ mentions })
}
