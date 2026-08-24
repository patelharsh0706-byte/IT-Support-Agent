import { NextRequest, NextResponse } from "next/server"
import { requireCustomer } from "@/lib/auth/session"
import {
  createServiceRequest,
  listServiceRequestsForCustomer,
  resolveCustomer,
} from "@/lib/sqlite/queries"

export async function GET() {
  const session = await requireCustomer().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const customer = await resolveCustomer(session.clerkUserId)
  const serviceRequests = await listServiceRequestsForCustomer(customer.id)
  return NextResponse.json({ serviceRequests })
}

export async function POST(request: NextRequest) {
  const session = await requireCustomer().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim()
      : "Untitled Ticket"

  const customer = await resolveCustomer(session.clerkUserId)
  const serviceRequest = await createServiceRequest(customer.id, title)
  return NextResponse.json({ serviceRequest }, { status: 201 })
}
