import { CustomerDashboard } from "@/components/customer/customer-dashboard"
import { requireCustomer } from "@/lib/auth/session"
import { toTicket } from "@/lib/mock/from-service-request"
import type { ChatMessage } from "@/lib/mock/types"
import { listServiceRequestsForCustomer, resolveCustomer } from "@/lib/sqlite/queries"

export default async function CustomerDashboardPage() {
  const session = await requireCustomer()
  const customer = await resolveCustomer(session.clerkUserId)
  const serviceRequests = await listServiceRequestsForCustomer(customer.id)
  const initialTickets = serviceRequests.map(toTicket)

  // The global chat-message fixtures are not scoped to a customer at all —
  // passing them here would let a signed-in customer see another
  // customer's fixture conversation if their ticket ids ever collided.
  // Real per-customer chat history is the agent-pipeline unit's job
  // (`lib/agent/`, not built yet); until then this starts empty rather
  // than leaking mock data.
  const initialMessages: ChatMessage[] = []

  return (
    <CustomerDashboard
      initialTickets={initialTickets}
      initialMessages={initialMessages}
    />
  )
}
