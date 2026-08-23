"use client"

import { useState } from "react"

import { ConversationHeader } from "@/components/admin/conversation-header"
import { ConversationThread } from "@/components/admin/conversation-thread"
import { ConversationContextSidebar } from "@/components/admin/conversation-context-sidebar"
import { ReplyComposer } from "@/components/admin/reply-composer"
import { buildCaseThread, type CaseThreadMessage } from "@/lib/mock/case-thread"
import { currentCsrName } from "@/lib/mock/current-csr"
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

  function handleSend(text: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `${grievanceCase.id}_msg_${Date.now()}`,
        caseId: grievanceCase.id,
        author: "csr",
        authorName: currentCsrName,
        body: text,
        timestamp: new Date().toISOString(),
      },
    ])
    setReplyState("replied")
    setContactedByCsrName(currentCsrName)
  }

  function handleAddPrivateNote(note: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `${grievanceCase.id}_note_${Date.now()}`,
        caseId: grievanceCase.id,
        author: "csr",
        authorName: currentCsrName,
        body: note,
        timestamp: new Date().toISOString(),
        isPrivateNote: true,
      },
    ])
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
