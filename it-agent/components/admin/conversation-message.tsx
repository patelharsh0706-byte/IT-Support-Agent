import { Lock } from "lucide-react"

import { EscalationMarker } from "@/components/shared/escalation-marker"
import type { CaseThreadMessage } from "@/lib/mock/case-thread"
import { cn } from "@/lib/utils"

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

interface ConversationMessageProps {
  message: CaseThreadMessage
}

export function ConversationMessage({ message }: ConversationMessageProps) {
  // A case event, not something the customer said — rendered as a centered
  // marker so it never reads as an ordinary reply in the thread.
  if (message.kind === "escalation") {
    return (
      <EscalationMarker
        title={`Escalated by ${message.authorName}`}
        reason={message.body}
        timestamp={message.timestamp}
      />
    )
  }

  if (message.isPrivateNote) {
    return (
      <div className="flex justify-center py-1.5">
        <div className="flex max-w-md items-start gap-2 rounded-lg bg-state-pending/10 px-3 py-2 text-[13px] text-state-pending">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p>
              <span className="sr-only">Private note: </span>
              {message.body}
            </p>
            <p className="mt-0.5 text-[11px] opacity-80">
              {message.authorName} · {timeFormatter.format(new Date(message.timestamp))}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isOutbound = message.author === "csr"

  return (
    <div className={cn("flex py-1.5", isOutbound ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-md flex-col gap-1", isOutbound && "items-end")}>
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-[14px]",
            isOutbound ? "bg-accent-soft text-foreground" : "bg-subtle text-foreground"
          )}
        >
          {message.body}
        </div>
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <span>{message.authorName}</span>
          <span>·</span>
          <span>{timeFormatter.format(new Date(message.timestamp))}</span>
          {message.permalink ? (
            <>
              <span>·</span>
              <a
                href={message.permalink}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                View on source
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
