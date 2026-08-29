import { FetchTweetsButton } from "@/components/admin/fetch-tweets-button"
import { MentionFeed } from "@/components/admin/mention-feed"
import { MentionFilters } from "@/components/admin/mention-filters"
import { PublishModeBadge } from "@/components/admin/publish-mode-badge"
import { isEffectivelyPublishing } from "@/lib/social/source-factory"
import { isTweetWindow, type Urgency } from "@/lib/social/types"
import { listTweetMentions } from "@/lib/sqlite/queries"

// No dynamic API is called on this page path, so Next would otherwise
// prerender it statically at build time and freeze the DB read.
export const dynamic = "force-dynamic"

function parseUrgency(value: string | undefined): Urgency | undefined {
  return value === "critical" || value === "high" || value === "normal" ? value : undefined
}

export default async function TwitterAgentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const one = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const windowParam = one("window")

  const filters = {
    windowHours: isTweetWindow(windowParam) ? Number(windowParam) : undefined,
    urgency: parseUrgency(one("urgency")),
    grievanceOnly: one("grievanceOnly") === "true",
    includeDismissed: one("includeDismissed") === "true",
    unrepliedOnly: one("unrepliedOnly") === "true",
  }

  const [mentions, everything] = await Promise.all([
    listTweetMentions(filters),
    // Distinguishes "nothing fetched yet" from "filtered down to nothing", so
    // the empty state can say which.
    listTweetMentions({ includeDismissed: true }),
  ])

  // Derived by query at render, never a stored counter (R24).
  const needsReplyNow = everything.filter(
    (m) =>
      m.isGrievance &&
      (m.urgency === "critical" || m.urgency === "high") &&
      m.dismissedAt === null &&
      !m.replies.some((r) => r.status === "sent"),
  ).length

  // The effective mode, not the raw flag: the reply endpoint forces a dry run
  // for the fixture source and for incomplete publish credentials, and the
  // badge and the confirm step must agree with it.
  const publishLive = isEffectivelyPublishing()

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-[22px] font-semibold text-foreground">Twitter Agents</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Brand mentions pulled from X, newest first, with the grievances surfaced.
          </p>
        </div>
        <FetchTweetsButton />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-state-error/10 px-3 py-1.5 text-[13px] font-medium text-state-error">
          {needsReplyNow} needs a reply now
        </span>
        <PublishModeBadge isLive={publishLive} />
      </div>

      <div className="mb-4">
        <MentionFilters />
      </div>

      <MentionFeed
        mentions={mentions}
        isPublishLive={publishLive}
        hasFetchedEver={everything.length > 0}
      />
    </div>
  )
}
