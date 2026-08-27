import { Suspense } from "react"

import { ConversationListPane } from "@/components/admin/conversation-list-pane"
import { ConversationListSkeleton } from "@/components/admin/conversation-list-skeleton"
import { requireCsrName } from "@/lib/auth/session"
import { listGrievanceCases } from "@/lib/sqlite/queries"

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cases, currentCsrName] = await Promise.all([listGrievanceCases(), requireCsrName()])

  return (
    <>
      <Suspense fallback={<ConversationListSkeleton />}>
        <ConversationListPane cases={cases} currentCsrName={currentCsrName} />
      </Suspense>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </>
  )
}
