"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PriorityBadge } from "@/components/shared/priority-badge"
import type { Ticket } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

interface TicketSidebarProps {
  isOpen: boolean
  onClose: () => void
  tickets: Ticket[]
  selectedTicketId: string | null
  onSelectTicket: (ticketId: string) => void
  onNewTicket?: () => void
  id?: string
  className?: string
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-10 text-center text-[13px] text-muted-foreground">
      {message}
    </div>
  )
}

/**
 * Ticket sidebar. Floats above the editor canvas and slides in from the
 * left, so opening it never pushes page content. Position is absolute — the
 * editor shell that renders it must establish a positioning context
 * (`relative`).
 */
export function TicketSidebar({
  isOpen,
  onClose,
  tickets,
  selectedTicketId,
  onSelectTicket,
  onNewTicket,
  id,
  className,
}: TicketSidebarProps) {
  return (
    <aside
      id={id}
      aria-label="Tickets"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "absolute inset-y-0 left-0 z-40 flex w-70 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-heading text-[22px] leading-none font-semibold">
          Tickets
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close tickets"
        >
          <X />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {tickets.length === 0 ? (
          <EmptyState message="No tickets yet." />
        ) : (
          <ul className="flex flex-col">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => onSelectTicket(ticket.id)}
                  aria-current={ticket.id === selectedTicketId}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-subtle",
                    ticket.id === selectedTicketId && "bg-subtle"
                  )}
                >
                  <span className="line-clamp-2 text-[15px] font-medium text-foreground">
                    {ticket.title}
                  </span>
                  <span className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    <span className="text-[13px] capitalize text-muted-foreground">
                      {ticket.status.replace("_", " ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          type="button"
          className="w-full"
          onClick={onNewTicket}
          disabled={!onNewTicket}
        >
          <Plus />
          New Ticket
        </Button>
      </div>
    </aside>
  )
}
