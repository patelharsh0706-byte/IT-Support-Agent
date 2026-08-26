import { NextRequest, NextResponse } from "next/server"
import { requireCsrName, requireCustomer } from "@/lib/auth/session"
import {
  getServiceRequestById,
  insertChatMessage,
  listChatMessagesForServiceRequest,
  markServiceRequestReplied,
  resolveCustomer,
} from "@/lib/sqlite/queries"

type RouteParams = { params: Promise<{ serviceRequestId: string }> }

async function authorize(serviceRequestId: string) {
  const session = await requireCustomer().catch(() => null)
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) } as const
  }

  const existing = await getServiceRequestById(serviceRequestId)
  if (!existing) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const
  }

  if (session.role === "customer") {
    const customer = await resolveCustomer(session.clerkUserId)
    if (existing.customerId !== customer.id) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const
    }
    return { role: "customer" as const, existing, customer }
  }

  // role === "csr": no ownership restriction — a CSR can read/reply on any case.
  return { role: "csr" as const, existing }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { serviceRequestId } = await params
  const result = await authorize(serviceRequestId)
  if ("error" in result) return result.error

  const messages = await listChatMessagesForServiceRequest(serviceRequestId)
  // Never let a private note reach a customer session — belt-and-braces
  // beyond the customer UI simply not rendering them.
  const visible =
    result.role === "customer" ? messages.filter((m) => !m.isPrivateNote) : messages
  return NextResponse.json({ messages: visible })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { serviceRequestId } = await params
  const result = await authorize(serviceRequestId)
  if ("error" in result) return result.error

  const body = await request.json().catch(() => ({}))
  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 })
  }

  if (result.existing.customerId === null) {
    return NextResponse.json(
      { error: "No customer identity linked to this case yet" },
      { status: 409 },
    )
  }

  const content = body.content.trim()

  if (result.role === "customer") {
    const message = await insertChatMessage({
      serviceRequestId,
      customerId: result.existing.customerId,
      authorRole: "customer",
      authorName: result.customer.name,
      content,
      // A customer can never write a private note — never trust client input for this.
      isPrivateNote: false,
    })
    return NextResponse.json({ message }, { status: 201 })
  }

  const csrName = await requireCsrName()
  // A customer can never set isPrivateNote; only honor it for a CSR sender.
  const isPrivateNote = body.isPrivateNote === true
  const message = await insertChatMessage({
    serviceRequestId,
    customerId: result.existing.customerId,
    authorRole: "csr",
    authorName: csrName,
    content,
    isPrivateNote,
  })
  if (!isPrivateNote) {
    await markServiceRequestReplied(serviceRequestId, csrName)
  }
  return NextResponse.json({ message }, { status: 201 })
}
