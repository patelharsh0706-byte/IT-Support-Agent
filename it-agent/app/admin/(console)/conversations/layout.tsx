import { Suspense } from "react"

import { ConversationListPane } from "@/components/admin/conversation-list-pane"
import { ConversationListSkeleton } from "@/components/admin/conversation-list-skeleton"
import { grievanceCases } from "@/lib/mock/fixtures"

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Suspense fallback={<ConversationListSkeleton />}>
        <ConversationListPane cases={grievanceCases} />
      </Suspense>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </>
  )
}
