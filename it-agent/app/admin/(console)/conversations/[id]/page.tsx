import { notFound } from "next/navigation"

import { ConversationPane } from "@/components/admin/conversation-pane"
import { requireCsrName } from "@/lib/auth/session"
import { getGrievanceCaseDetail } from "@/lib/sqlite/queries"

export default async function ConversationPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { id } = await params
  const [grievanceCase, currentCsrName] = await Promise.all([
    getGrievanceCaseDetail(id),
    requireCsrName(),
  ])

  if (!grievanceCase) {
    notFound()
  }

  return (
    <ConversationPane
      key={grievanceCase.id}
      grievanceCase={grievanceCase}
      currentCsrName={currentCsrName}
    />
  )
}
