"use client"

import { useMemo, useState } from "react"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import { TicketSidebar } from "@/components/editor/ticket-sidebar"
import { ChatHeader } from "@/components/editor/chat-header"
import { MessageList } from "@/components/editor/message-list"
import { Composer } from "@/components/editor/composer"
import { AgentActivityPanel } from "@/components/editor/agent-activity-panel"
import { EditorDialog } from "@/components/editor/editor-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { chatMessages as initialChatMessages, tickets as initialTickets } from "@/lib/mock/fixtures"
import type { ChatMessage, Ticket } from "@/lib/mock/types"

export default function EditorPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets.find((t) => t.id === "tkt_3")?.id ?? initialTickets[0]?.id ?? null
  )
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false)
  const [newTicketTitle, setNewTicketTitle] = useState("")

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null

  const ticketMessages = useMemo(
    () => messages.filter((m) => m.ticketId === selectedTicketId),
    [messages, selectedTicketId]
  )

  const activityEvents = useMemo(
    () =>
      ticketMessages
        .flatMap((m) => m.activityEvents ?? [])
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [ticketMessages]
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

  function handleCreateTicket() {
    const title = newTicketTitle.trim()
    if (!title) return
    const now = new Date().toISOString()
    const newTicket: Ticket = {
      id: `tkt_${Date.now()}`,
      intent: "update_contact_info",
      title,
      priority: "medium",
      status: "open",
      createdAt: now,
      updatedAt: now,
    }
    setTickets((prev) => [newTicket, ...prev])
    setSelectedTicketId(newTicket.id)
    setNewTicketTitle("")
    setIsNewTicketOpen(false)
    setIsSidebarOpen(false)
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
          onNewTicket={() => setIsNewTicketOpen(true)}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatHeader ticket={selectedTicket} />
          <MessageList messages={ticketMessages} />
          <Composer onSend={handleSend} disabled={!selectedTicketId} />
        </div>

        <AgentActivityPanel events={activityEvents} />
      </div>

      <EditorDialog
        open={isNewTicketOpen}
        onOpenChange={setIsNewTicketOpen}
        title="New Ticket"
        description="Start a new conversation with the servicing agent."
        actions={
          <Button type="button" onClick={handleCreateTicket}>
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
              handleCreateTicket()
            }
          }}
          placeholder="What do you need help with?"
        />
      </EditorDialog>
    </div>
  )
}
