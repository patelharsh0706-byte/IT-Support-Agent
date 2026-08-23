import { notFound } from "next/navigation"

import { ConversationPane } from "@/components/admin/conversation-pane"
import { grievanceCases } from "@/lib/mock/fixtures"

export default async function ConversationPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { id } = await params
  const grievanceCase = grievanceCases.find((c) => c.id === id)

  if (!grievanceCase) {
    notFound()
  }

  return <ConversationPane key={grievanceCase.id} grievanceCase={grievanceCase} />
}
