"use client"

import { useMemo, useState } from "react"

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
import type { ChatMessage, Ticket } from "@/lib/mock/types"

interface CustomerDashboardProps {
  initialTickets: Ticket[]
  initialMessages: ChatMessage[]
}

export function CustomerDashboard({ initialTickets, initialMessages }: CustomerDashboardProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets[0]?.id ?? null
  )
  const [isEscalateOpen, setIsEscalateOpen] = useState(false)
  const [escalationReason, setEscalationReason] = useState("")

  const {
    isCreateOpen,
    openCreate,
    setIsCreateOpen,
    title: newTicketTitle,
    setTitle: setNewTicketTitle,
    createTicket,
  } = useServiceRequestActions({ setTickets, setSelectedTicketId })

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null

  const ticketMessages = useMemo(
    () => messages.filter((m) => m.ticketId === selectedTicketId),
    [messages, selectedTicketId]
  )

  function handleSend(content: string) {
    if (!selectedTicketId) return
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        ticketId: selectedTicketId,
        authorRole: "customer",
        authorName: "You",
        content,
        timestamp: new Date().toISOString(),
      },
    ])
  }

  function handleEscalate() {
    const reason = escalationReason.trim()
    if (!selectedTicketId || !reason) return
    const now = new Date().toISOString()
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === selectedTicketId
          ? {
              ...ticket,
              status: "escalated",
              escalatedAt: now,
              escalationReason: reason,
              updatedAt: now,
            }
          : ticket
      )
    )
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        ticketId: selectedTicketId,
        authorRole: "agent",
        authorName: "Servicing Agent",
        content:
          "This ticket has been escalated to an admin. A specialist will review it and reply here.",
        timestamp: now,
      },
    ])
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
            setSelectedTicketId(id)
            setIsSidebarOpen(false)
          }}
          onNewTicket={openCreate}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatHeader ticket={selectedTicket} />
          <MessageList messages={ticketMessages} />
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
            onClick={handleEscalate}
            disabled={!escalationReason.trim()}
          >
            Escalate
          </Button>
        }
      >
        <Textarea
          autoFocus
          value={escalationReason}
          onChange={(event) => setEscalationReason(event.target.value)}
          placeholder="Why does this need a human?"
        />
      </EditorDialog>
    </div>
  )
}
