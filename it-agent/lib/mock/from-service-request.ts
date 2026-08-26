import type { serviceRequests } from "@/lib/sqlite/schema"
import type { Ticket } from "./types"

type ServiceRequestRow = typeof serviceRequests.$inferSelect

/**
 * Narrows a `service_request` row (customer/CSR-agnostic, every column) down
 * to the `Ticket` shape the customer dashboard renders. The only mapping
 * boundary for real data — everything downstream keeps consuming `Ticket`
 * unchanged, per `05-sqlite.md`'s "drop-in, not a rewrite" intent.
 */
export function toTicket(row: ServiceRequestRow): Ticket {
  return {
    id: row.id,
    intent: row.intent,
    title: row.title,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    escalatedAt: row.escalatedAt,
    escalationReason: undefined,
  }
}
