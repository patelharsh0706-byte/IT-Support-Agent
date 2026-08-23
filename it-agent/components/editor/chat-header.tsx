import { PriorityBadge } from "@/components/shared/priority-badge"
import type { Intent, Ticket } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

const intentLabel: Record<Intent, string> = {
  card_unblock_activation: "Card Servicing",
  unrecognized_transaction: "Transaction & Dispute Servicing",
  update_contact_info: "Account & Profile Servicing",
}

interface ChatHeaderProps {
  ticket: Ticket | null
  className?: string
}

/** Pinned centre-column header: ticket title + intent/priority subtitle. */
export function ChatHeader({ ticket, className }: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4",
        className
      )}
    >
      {ticket ? (
        <>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-foreground">
              {ticket.title}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              {intentLabel[ticket.intent]}
            </p>
          </div>
          <PriorityBadge priority={ticket.priority} />
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Select a ticket to view the conversation.
        </p>
      )}
    </div>
  )
}
