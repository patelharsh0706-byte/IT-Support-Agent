import { and, eq } from "drizzle-orm"
import { currentUser } from "@clerk/nextjs/server"
import { db } from "./client"
import { customers, serviceRequests } from "./schema"

// Resolves `customers.clerk_user_id` to the internal customer row, per
// `feature-specs/06-project-api.md`'s Rules section and
// `context/progress-tracker.md`'s U2 follow-up ("Next step is linking the
// two"). No seeded customer has `clerk_user_id` set, so a first-time
// sign-in provisions its own row from the Clerk profile rather than
// failing closed.
export async function resolveCustomer(clerkUserId: string) {
  const existing = await db.query.customers.findFirst({
    where: eq(customers.clerkUserId, clerkUserId),
  })
  if (existing) return existing

  const clerkProfile = await currentUser()
  const email = clerkProfile?.primaryEmailAddress?.emailAddress ?? `${clerkUserId}@unknown`
  const name = clerkProfile?.fullName ?? email

  const [created] = await db
    .insert(customers)
    .values({
      id: `cust_${crypto.randomUUID()}`,
      clerkUserId,
      name,
      email,
      status: "active",
    })
    .returning()
  return created
}

export async function listServiceRequestsForCustomer(customerId: string) {
  return db.query.serviceRequests.findMany({
    where: eq(serviceRequests.customerId, customerId),
  })
}

export async function createServiceRequest(customerId: string, title: string) {
  const now = new Date().toISOString()
  const [created] = await db
    .insert(serviceRequests)
    .values({
      id: `tkt_${crypto.randomUUID()}`,
      customerId,
      channel: "amex_support",
      intent: null,
      title,
      priority: "medium",
      status: "open",
      currentSeverity: "low",
      customerVerified: true,
      replyState: "needs_reply",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return created
}

export async function getServiceRequestById(id: string) {
  return db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, id),
  })
}

export async function renameServiceRequest(id: string, title: string) {
  const [updated] = await db
    .update(serviceRequests)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(serviceRequests.id, id))
    .returning()
  return updated
}

export async function deleteServiceRequest(id: string, customerId: string) {
  await db
    .delete(serviceRequests)
    .where(and(eq(serviceRequests.id, id), eq(serviceRequests.customerId, customerId)))
}
