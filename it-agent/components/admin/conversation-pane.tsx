"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { ConversationHeader } from "@/components/admin/conversation-header"
import { ConversationThread } from "@/components/admin/conversation-thread"
import { ConversationContextSidebar } from "@/components/admin/conversation-context-sidebar"
import { ReplyComposer } from "@/components/admin/reply-composer"
import { buildCaseThread, type CaseThreadMessage } from "@/lib/mock/case-thread"
import type { GrievanceCase } from "@/lib/mock/types"

interface ConversationPaneProps {
  grievanceCase: GrievanceCase
}

export function ConversationPane({ grievanceCase }: ConversationPaneProps) {
  const [replyState, setReplyState] = useState(grievanceCase.replyState)
  const [contactedByCsrName, setContactedByCsrName] = useState(
    grievanceCase.contactedByCsrName
  )
  const [messages, setMessages] = useState<CaseThreadMessage[]>(() =>
    buildCaseThread(grievanceCase)
  )
  const [isContextOpen, setIsContextOpen] = useState(true)
  // Resolved is distinct from replyState: resolving a case doesn't send a
  // reply, and sending a reply doesn't resolve the case.
  const [isResolved, setIsResolved] = useState(grievanceCase.replyState === "replied")
  const router = useRouter()

  /**
   * Persists one CSR message and appends the row the server actually
   * wrote — id and timestamp come back from SQLite rather than being
   * invented client-side, so a refresh renders the same thread.
   */
  async function postMessage(content: string, isPrivateNote: boolean) {
    const response = await fetch(`/api/service-requests/${grievanceCase.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, isPrivateNote }),
    }).catch(() => null)
    if (!response?.ok) return null

    const { message } = await response.json()
    setMessages((prev) => [
      ...prev,
      {
        id: message.id,
        caseId: grievanceCase.id,
        kind: "message",
        author: "csr",
        authorName: message.authorName,
        body: message.content,
        timestamp: message.timestamp,
        isPrivateNote: message.isPrivateNote,
      },
    ])
    // Re-reads the server components around this pane (conversation list
    // preview, queue table, nav counts) so they stop disagreeing with the
    // thread the CSR is looking at.
    router.refresh()
    return message
  }

  async function handleSend(text: string) {
    const message = await postMessage(text, false)
    if (!message) return false
    // Mirrors the route's own side effect: a public send marks the case
    // replied and stamps the CSR who sent it.
    setReplyState("replied")
    setContactedByCsrName(message.authorName)
    return true
  }

  async function handleAddPrivateNote(note: string) {
    // A note is deliberately not a reply — it must not move `replyState`.
    return (await postMessage(note, true)) !== null
  }

  function handleResolve() {
    setIsResolved(true)
  }

  function handleMarkUnattended() {
    setReplyState("needs_reply")
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ConversationHeader
          grievanceCase={grievanceCase}
          isResolved={isResolved}
          isContextOpen={isContextOpen}
          onToggleContext={() => setIsContextOpen((open) => !open)}
          onResolve={handleResolve}
          onMarkUnattended={handleMarkUnattended}
        />
        <ConversationThread messages={messages} />
        <ReplyComposer
          replyState={replyState}
          aiDraftReply={grievanceCase.aiDraftReply}
          contactedByCsrName={contactedByCsrName}
          onSend={handleSend}
          onAddPrivateNote={handleAddPrivateNote}
          className="shrink-0"
        />
      </div>

      <ConversationContextSidebar
        grievanceCase={grievanceCase}
        isOpen={isContextOpen}
        onClose={() => setIsContextOpen(false)}
      />
    </div>
  )
}
