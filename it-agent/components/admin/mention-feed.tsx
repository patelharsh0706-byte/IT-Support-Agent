import { Inbox } from "lucide-react"

import { MentionRow } from "@/components/admin/mention-row"
import type { TweetMentionView } from "@/lib/social/types"

interface MentionFeedProps {
  mentions: TweetMentionView[]
  isPublishLive: boolean
  /** True when the store is empty, as opposed to filtered down to nothing. */
  hasFetchedEver: boolean
}

export function MentionFeed({ mentions, isPublishLive, hasFetchedEver }: MentionFeedProps) {
  if (mentions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <Inbox className="size-6 text-muted-foreground" />
        <p className="text-[15px] font-medium text-foreground">
          {hasFetchedEver ? "Nothing matches these filters" : "No mentions yet"}
        </p>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          {hasFetchedEver
            ? "Widen the time window or clear a filter to see more."
            : "Press Fetch tweets to pull the latest brand mentions. Nothing runs on a timer."}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {mentions.map((mention) => (
        <MentionRow key={mention.id} mention={mention} isPublishLive={isPublishLive} />
      ))}
    </div>
  )
}
