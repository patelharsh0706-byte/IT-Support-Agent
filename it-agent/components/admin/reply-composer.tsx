"use client"

import { useState } from "react"
import { CheckCircle2, Lock, SendHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { ReplyState } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

const replyStateLabel: Record<ReplyState, string> = {
  needs_reply: "Needs reply",
  draft_ready: "Draft ready",
  replied: "Replied",
  escalated: "Escalated",
}

const replyStateClassName: Record<ReplyState, string> = {
  needs_reply: "bg-state-error/10 text-state-error",
  draft_ready: "bg-state-pending/10 text-state-pending",
  replied: "bg-state-success/10 text-state-success",
  escalated: "bg-muted text-muted-foreground",
}

interface ReplyComposerProps {
  replyState: ReplyState
  aiDraftReply?: string
  contactedByCsrName: string | null
  /** Resolves false when the send failed — the draft is kept so nothing is lost. */
  onSend: (finalText: string) => Promise<boolean>
  /** Private note is persisted CSR-side only — never delivered to the customer. */
  onAddPrivateNote?: (note: string) => Promise<boolean>
  className?: string
}

/**
 * Agent drafts, human sends only — there is no auto-send path and no
 * configuration flag that could create one (R11). Sending records the
 * final text; if the CSR edited the draft, both versions would be stored
 * server-side (not modeled here). Both tabs persist through
 * `POST /api/service-requests/[id]/messages`; the note tab sets
 * `isPrivateNote`, which that route strips from every customer read.
 */
export function ReplyComposer({
  replyState,
  aiDraftReply,
  contactedByCsrName,
  onSend,
  onAddPrivateNote,
  className,
}: ReplyComposerProps) {
  const [replyDraft, setReplyDraft] = useState(aiDraftReply ?? "")
  const [noteDraft, setNoteDraft] = useState("")
  const [pending, setPending] = useState<"reply" | "note" | null>(null)
  // Keyed by tab so a failed note never surfaces its error over the reply tab.
  const [error, setError] = useState<{ kind: "reply" | "note"; message: string } | null>(null)

  async function submit(kind: "reply" | "note") {
    const draft = kind === "reply" ? replyDraft.trim() : noteDraft.trim()
    if (draft.length === 0 || pending) return
    setPending(kind)
    setError(null)
    const ok =
      kind === "reply" ? await onSend(draft) : ((await onAddPrivateNote?.(draft)) ?? false)
    setPending(null)
    if (!ok) {
      setError({
        kind,
        message:
          kind === "reply"
            ? "Could not send the reply. The draft is still here — try again."
            : "Could not save the note. It is still here — try again.",
      })
      return
    }
    // Cleared only on a confirmed write, so a failed send never loses text.
    if (kind === "reply") setReplyDraft("")
    else setNoteDraft("")
  }

  return (
    <div className={cn("border-t border-border bg-surface p-4", className)}>
      <Tabs defaultValue="reply">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="reply">Reply</TabsTrigger>
            <TabsTrigger value="note">Private Note</TabsTrigger>
          </TabsList>
          <Badge
            variant="outline"
            className={cn("border-transparent", replyStateClassName[replyState])}
          >
            {replyStateLabel[replyState]}
          </Badge>
        </div>

        <TabsContent value="reply" className="mt-3">
          <div className="flex flex-col gap-3">
            {replyState === "replied" ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <CheckCircle2 className="size-4 text-state-success" />
                Sent{contactedByCsrName ? ` by ${contactedByCsrName}` : ""}. You can still
                send a follow-up below.
              </p>
            ) : replyState === "escalated" ? (
              <p className="text-[13px] text-muted-foreground">
                Escalated. You can still reply below.
              </p>
            ) : null}
            <Textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              placeholder="Draft a reply…"
              className="min-h-24"
            />
            {error?.kind === "reply" && pending === null ? (
              <p role="alert" className="text-[13px] text-state-error">
                {error.message}
              </p>
            ) : null}
            <Button
              type="button"
              className="self-end"
              disabled={replyDraft.trim().length === 0 || pending !== null}
              onClick={() => void submit("reply")}
            >
              <SendHorizontal data-icon="inline-start" />
              {pending === "reply" ? "Sending…" : "Send"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="note" className="mt-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg bg-state-pending/10 px-3 py-2 text-[12px] text-state-pending">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>Private note — not sent to the customer.</span>
            </div>
            <Textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Leave a note for the team…"
              className="min-h-24"
            />
            {error?.kind === "note" && pending === null ? (
              <p role="alert" className="text-[13px] text-state-error">
                {error.message}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="self-end"
              disabled={noteDraft.trim().length === 0 || pending !== null}
              onClick={() => void submit("note")}
            >
              {pending === "note" ? "Saving…" : "Add note"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
