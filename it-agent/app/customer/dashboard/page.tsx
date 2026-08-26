import { CustomerDashboard } from "@/components/customer/customer-dashboard"
import { requireCustomer } from "@/lib/auth/session"
import { toChatMessage, toTicket } from "@/lib/mock/from-service-request"
import {
  listChatMessagesForServiceRequest,
  listServiceRequestsForCustomer,
  resolveCustomer,
} from "@/lib/sqlite/queries"

export default async function CustomerDashboardPage() {
  const session = await requireCustomer()
  const customer = await resolveCustomer(session.clerkUserId)
  const serviceRequests = await listServiceRequestsForCustomer(customer.id)
  const initialTickets = serviceRequests.map(toTicket)

  // Only the thread the customer lands on is rendered server-side; the rest
  // are fetched from `/api/service-requests/[id]/messages` as they open
  // each one. `listServiceRequestsForCustomer` already scoped this list to
  // the signed-in customer, so the first ticket is theirs by construction.
  const firstTicket = initialTickets[0]
  const initialMessages = firstTicket
    ? (await listChatMessagesForServiceRequest(firstTicket.id))
        // A private note is CSR-only — same rule the messages route applies.
        .filter((row) => !row.isPrivateNote)
        .map((row) => toChatMessage(row, firstTicket.id))
    : []

  return (
    <CustomerDashboard initialTickets={initialTickets} initialMessages={initialMessages} />
  )
}
