import { NextRequest, NextResponse } from "next/server"
import { requireCustomer } from "@/lib/auth/session"
import { escalateServiceRequest, getServiceRequestById, resolveCustomer } from "@/lib/sqlite/queries"

type RouteParams = { params: Promise<{ serviceRequestId: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await requireCustomer().catch(() => null)
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const { serviceRequestId } = await params
  const existing = await getServiceRequestById(serviceRequestId)
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const customer = await resolveCustomer(session.clerkUserId)
  if (existing.customerId !== customer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 })
  }

  const serviceRequest = await escalateServiceRequest(
    serviceRequestId,
    body.reason.trim(),
    customer.id,
    customer.name,
  )
  return NextResponse.json({ serviceRequest })
}
