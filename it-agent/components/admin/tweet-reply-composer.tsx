"use client"

import { useState } from "react"
import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { PublishModeBadge } from "@/components/admin/publish-mode-badge"
import { MAX_TWEET_LENGTH, type GuardViolation } from "@/lib/social/reply-guard"
import { cn } from "@/lib/utils"

interface TweetReplyComposerProps {
  authorHandle: string
  isPublishLive: boolean
  /** Resolves false when the send failed — the draft is kept so nothing is lost. */
  onSend: (text: string) => Promise<{ ok: boolean; violations?: GuardViolation[]; error?: string }>
  onCancel: () => void
}

/**
 * Reuses the contract `08-persisted-messages.md` set for `reply-composer.tsx`
 * — `onSend` resolves a boolean, the draft clears only on a confirmed write,
 * a failure shows inline and keeps the text — and adds the two things a
 * public post needs: a character counter and an explicit confirm step.
 */
export function TweetReplyComposer({
  authorHandle,
  isPublishLive,
  onSend,
  onCancel,
}: TweetReplyComposerProps) {
  const [text, setText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [violations, setViolations] = useState<GuardViolation[]>([])
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_TWEET_LENGTH - text.length
  const overLimit = remaining < 0
  const canSend = text.trim().length > 0 && !overLimit && !isSending

  async function handleConfirmedSend() {
    setIsSending(true)
    setViolations([])
    setError(null)

    const result = await onSend(text.trim())

    setIsSending(false)
    setConfirmOpen(false)

    if (!result.ok) {
      setViolations(result.violations ?? [])
      setError(result.error ?? null)
      return
    }
    // Cleared only on a confirmed write.
    setText("")
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">
          Replying publicly to <span className="font-medium text-foreground">@{authorHandle}</span>
        </span>
        <PublishModeBadge isLive={isPublishLive} />
      </div>

      <Textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Acknowledge, apologise, and invite them to a secure channel…"
        className="min-h-20"
      />

      {violations.length > 0 ? (
        <div role="alert" className="rounded-lg bg-state-error/10 px-3 py-2 text-[13px] text-state-error">
          <p className="font-medium">Blocked before sending — nothing was posted.</p>
          <ul className="mt-1 list-disc pl-4">
            {violations.map((violation) => (
              <li key={violation.rule}>{violation.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-state-error">
          {error} Your draft is still here — try again.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[12px] tabular-nums",
            overLimit ? "font-medium text-state-error" : "text-muted-foreground",
          )}
        >
          {remaining}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
            <SendHorizontal data-icon="inline-start" />
            Review and send
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !isSending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPublishLive ? `Post this publicly to @${authorHandle}?` : "Send as a dry run?"}
            </DialogTitle>
            <DialogDescription>
              {isPublishLive
                ? "This posts to X under the brand's name and cannot be taken back from here."
                : "Publishing is off, so this records the reply and posts nothing to X."}
            </DialogDescription>
          </DialogHeader>

          <p className="whitespace-pre-wrap rounded-lg bg-subtle px-3 py-2 text-[14px] text-foreground">
            {text.trim()}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isSending}
            >
              Back
            </Button>
            <Button type="button" onClick={() => void handleConfirmedSend()} disabled={isSending}>
              {isSending ? "Sending…" : isPublishLive ? "Post to X" : "Send dry run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
