"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ExternalLink, EyeOff, MessageSquare, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TweetReplyComposer } from "@/components/admin/tweet-reply-composer"
import { UrgencyBadge } from "@/components/shared/urgency-badge"
import { formatDuration } from "@/lib/format-duration"
import type { GuardViolation } from "@/lib/social/reply-guard"
import type { TweetMentionView } from "@/lib/social/types"
import { cn } from "@/lib/utils"

interface MentionRowProps {
  mention: TweetMentionView
  isPublishLive: boolean
}

export function MentionRow({ mention, isPublishLive }: MentionRowProps) {
  const [isComposing, setIsComposing] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const router = useRouter()

  const sentReplies = mention.replies.filter((r) => r.status === "sent")
  const failedReplies = mention.replies.filter((r) => r.status === "failed")
  const isDismissed = mention.dismissedAt !== null

  async function handleSend(text: string) {
    const response = await fetch(`/api/social/tweets/${mention.tweetId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null)

    if (!response) {
      return { ok: false, error: "Could not reach the server." }
    }

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        violations: payload.violations as GuardViolation[] | undefined,
        error: payload.violations ? undefined : (payload.error ?? "The send failed."),
      }
    }

    setIsComposing(false)
    router.refresh()
    return { ok: true }
  }

  async function handleDismiss(dismissed: boolean) {
    setIsDismissing(true)
    await fetch(`/api/social/tweets/${mention.tweetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed }),
    }).catch(() => null)
    setIsDismissing(false)
    router.refresh()
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0",
        isDismissed && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium text-foreground">{mention.authorName}</span>
        <span className="text-[13px] text-muted-foreground">@{mention.authorHandle}</span>
        <span className="text-[13px] text-muted-foreground">·</span>
        <span className="text-[13px] text-muted-foreground">
          {formatDuration(mention.postedAt)} ago
        </span>
        {mention.isGrievance ? <UrgencyBadge urgency={mention.urgency} /> : null}
        {isDismissed ? (
          <span className="text-[12px] text-muted-foreground">Dismissed</span>
        ) : null}
      </div>

      <p className="text-[15px] text-foreground">{mention.text}</p>

      {/* The reasons, not just the badge: an admin who cannot see why a tweet
          is critical stops trusting the mark. */}
      {mention.urgencyReasons.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {mention.urgencyReasons.map((reason) => (
            <li
              key={reason}
              className="rounded-lg bg-subtle px-2 py-0.5 text-[12px] text-muted-foreground"
            >
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {sentReplies.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-state-success/5 px-3 py-2">
          {sentReplies.map((reply) => (
            <div key={reply.id} className="text-[13px]">
              <p className="flex items-center gap-1.5 text-state-success">
                <CheckCircle2 className="size-3.5 shrink-0" />
                {reply.isDryRun ? "Dry run" : "Posted"} by {reply.sentByCsrName}
                {reply.sentAt ? ` · ${formatDuration(reply.sentAt)} ago` : ""}
              </p>
              <p className="mt-0.5 text-foreground">{reply.text}</p>
              {reply.platformPermalink && !reply.isDryRun ? (
                <a
                  href={reply.platformPermalink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  View the reply on X
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {failedReplies.map((reply) => (
        <div
          key={reply.id}
          className="rounded-lg bg-state-error/10 px-3 py-2 text-[13px] text-state-error"
        >
          <p className="font-medium">Send failed — this was not posted.</p>
          <p className="mt-0.5">{reply.error}</p>
          <p className="mt-0.5 text-foreground/80">{reply.text}</p>
        </div>
      ))}

      {isComposing ? (
        <TweetReplyComposer
          authorHandle={mention.authorHandle}
          isPublishLive={isPublishLive}
          onSend={handleSend}
          onCancel={() => setIsComposing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => setIsComposing(true)}>
            <MessageSquare data-icon="inline-start" />
            {sentReplies.length > 0 ? "Reply again" : "Reply"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isDismissing}
            onClick={() => void handleDismiss(!isDismissed)}
          >
            {isDismissed ? (
              <>
                <Undo2 data-icon="inline-start" />
                Restore
              </>
            ) : (
              <>
                <EyeOff data-icon="inline-start" />
                Dismiss
              </>
            )}
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={mention.permalink} target="_blank" rel="noreferrer">
              <ExternalLink data-icon="inline-start" />
              Open on X
            </a>
          </Button>
        </div>
      )}
    </article>
  )
}
