import { CustomerDashboard } from "@/components/customer/customer-dashboard"
import { requireCustomer } from "@/lib/auth/session"
import { toTicket } from "@/lib/mock/from-service-request"
import { chatMessages as initialChatMessages } from "@/lib/mock/fixtures"
import { listServiceRequestsForCustomer, resolveCustomer } from "@/lib/sqlite/queries"

export default async function CustomerDashboardPage() {
  const session = await requireCustomer()
  const customer = await resolveCustomer(session.clerkUserId)
  const serviceRequests = await listServiceRequestsForCustomer(customer.id)
  const initialTickets = serviceRequests.map(toTicket)

  return (
    <CustomerDashboard
      initialTickets={initialTickets}
      initialMessages={initialChatMessages}
    />
  )
}
