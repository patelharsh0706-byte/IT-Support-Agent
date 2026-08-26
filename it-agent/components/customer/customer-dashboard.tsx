"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import { TicketSidebar } from "@/components/editor/ticket-sidebar"
import { ChatHeader } from "@/components/editor/chat-header"
import { MessageList } from "@/components/editor/message-list"
import { Composer } from "@/components/editor/composer"
import { TicketStatusPanel } from "@/components/editor/ticket-status-panel"
import { EditorDialog } from "@/components/editor/editor-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useServiceRequestActions } from "@/hooks/useServiceRequestActions"
import { toChatMessage, toTicket } from "@/lib/mock/from-service-request"
import type { ChatMessage, Ticket } from "@/lib/mock/types"

interface CustomerDashboardProps {
  initialTickets: Ticket[]
  /** The first ticket's thread, server-rendered so the initial view needs no fetch. */
  initialMessages: ChatMessage[]
}

export function CustomerDashboard({
  initialTickets,
  initialMessages,
}: CustomerDashboardProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  // Every ticket's messages in one flat list, filtered per selection below.
  // Threads past the first are loaded from `/messages` on selection.
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets[0]?.id ?? null
  )
  // Which threads are already in `messages`. The first ticket arrives
  // server-rendered, so it starts loaded.
  const [loadedTicketIds, setLoadedTicketIds] = useState<string[]>(() =>
    initialTickets[0] ? [initialTickets[0].id] : []
  )
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isEscalateOpen, setIsEscalateOpen] = useState(false)
  const [escalationReason, setEscalationReason] = useState("")
  const [escalateError, setEscalateError] = useState<string | null>(null)
  const [isEscalating, setIsEscalating] = useState(false)
  const router = useRouter()

  const {
    isCreateOpen,
    openCreate,
    setIsCreateOpen,
    title: newTicketTitle,
    setTitle: setNewTicketTitle,
    createTicket,
  } = useServiceRequestActions({ setTickets, setSelectedTicketId: handleTicketCreated })

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null

  const ticketMessages = useMemo(
    () =>
      messages
        .filter((m) => m.ticketId === selectedTicketId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)),
    [messages, selectedTicketId]
  )

  /**
   * Replaces one ticket's slice of the flat message list with what the
   * server currently holds. Private notes never arrive here — the route
   * strips them from every customer read.
   */
  const loadMessages = useCallback(async (ticketId: string) => {
    const response = await fetch(`/api/service-requests/${ticketId}/messages`).catch(
      () => null
    )
    if (!response?.ok) return false

    const { messages: rows } = await response.json()
    const loaded: ChatMessage[] = rows.map((row: Parameters<typeof toChatMessage>[0]) =>
      toChatMessage(row, ticketId)
    )
    setMessages((prev) => [...prev.filter((m) => m.ticketId !== ticketId), ...loaded])
    return true
  }, [])

  /**
   * Selecting a ticket loads its thread once, on the interaction that needs
   * it — no effect, so there is no cascading render and no fetch for a
   * thread the customer never opens.
   */
  async function handleSelectTicket(ticketId: string) {
    setSelectedTicketId(ticketId)
    if (loadedTicketIds.includes(ticketId)) return

    setIsLoadingMessages(true)
    const ok = await loadMessages(ticketId)
    setIsLoadingMessages(false)
    if (ok) {
      setLoadedTicketIds((prev) => (prev.includes(ticketId) ? prev : [...prev, ticketId]))
    }
  }

  /** A just-created ticket has no thread yet — nothing to fetch for it. */
  function handleTicketCreated(ticketId: string) {
    setSelectedTicketId(ticketId)
    setLoadedTicketIds((prev) => (prev.includes(ticketId) ? prev : [...prev, ticketId]))
  }

  async function handleSend(content: string) {
    if (!selectedTicketId) return false
    const response = await fetch(`/api/service-requests/${selectedTicketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).catch(() => null)
    if (!response?.ok) return false

    // Appends the row the server wrote — its id and timestamp, so a
    // refresh renders the same thread rather than a client-invented one.
    const { message } = await response.json()
    setMessages((prev) => [...prev, toChatMessage(message, selectedTicketId)])
    return true
  }

  async function handleEscalate() {
    const ticketId = selectedTicketId
    const reason = escalationReason.trim()
    if (!ticketId || !reason || isEscalating) return

    setIsEscalating(true)
    setEscalateError(null)
    const response = await fetch(`/api/service-requests/${ticketId}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null)
    setIsEscalating(false)

    if (!response?.ok) {
      setEscalateError("Could not escalate this ticket. Your reason is still here — try again.")
      return
    }

    // The route escalates and writes the reason into the thread in one
    // transaction, so the ticket is replaced from the returned row and the
    // thread is re-read rather than guessed at client-side.
    const { serviceRequest } = await response.json()
    const updated = toTicket(serviceRequest)
    setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? updated : ticket)))
    await loadMessages(ticketId)
    // Keeps the server-rendered ticket list in step with the escalation.
    router.refresh()

    setEscalationReason("")
    setIsEscalateOpen(false)
  }

  return (
    <div className="flex h-screen flex-col">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        sidebarId="ticket-sidebar"
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <TicketSidebar
          id="ticket-sidebar"
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          onSelectTicket={(id) => {
            void handleSelectTicket(id)
            setIsSidebarOpen(false)
          }}
          onNewTicket={openCreate}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatHeader ticket={selectedTicket} />
          {isLoadingMessages ? (
            <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-[13px] text-muted-foreground">
              Loading messages…
            </div>
          ) : (
            <MessageList messages={ticketMessages} />
          )}
          <Composer onSend={handleSend} disabled={!selectedTicketId} />
        </div>

        <TicketStatusPanel
          ticket={selectedTicket}
          onEscalate={() => setIsEscalateOpen(true)}
        />
      </div>

      <EditorDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="New Ticket"
        description="Start a new conversation with the servicing agent."
        actions={
          <Button type="button" onClick={createTicket}>
            Create
          </Button>
        }
      >
        <Input
          autoFocus
          value={newTicketTitle}
          onChange={(event) => setNewTicketTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              createTicket()
            }
          }}
          placeholder="What do you need help with?"
        />
      </EditorDialog>

      <EditorDialog
        open={isEscalateOpen}
        onOpenChange={setIsEscalateOpen}
        title="Escalate to admin"
        description="A human specialist will pick this up and reply in the same thread."
        actions={
          <Button
            type="button"
            onClick={() => void handleEscalate()}
            disabled={!escalationReason.trim() || isEscalating}
          >
            {isEscalating ? "Escalating…" : "Escalate"}
          </Button>
        }
      >
        <Textarea
          autoFocus
          value={escalationReason}
          onChange={(event) => setEscalationReason(event.target.value)}
          placeholder="Why does this need a human?"
        />
        {escalateError ? (
          <p role="alert" className="mt-2 text-[13px] text-state-error">
            {escalateError}
          </p>
        ) : null}
      </EditorDialog>
    </div>
  )
}
