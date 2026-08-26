import { notFound } from "next/navigation"

import { ConversationPane } from "@/components/admin/conversation-pane"
import { getGrievanceCaseDetail } from "@/lib/sqlite/queries"

export default async function ConversationPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { id } = await params
  // The CSR's own name is no longer needed here: a sent message is stamped
  // server-side by `requireCsrName()` inside the messages route, and the
  // pane renders the name that came back from the write.
  const grievanceCase = await getGrievanceCaseDetail(id)

  if (!grievanceCase) {
    notFound()
  }

  return (
    <ConversationPane
      key={grievanceCase.id}
      grievanceCase={grievanceCase}
    />
  )
}
