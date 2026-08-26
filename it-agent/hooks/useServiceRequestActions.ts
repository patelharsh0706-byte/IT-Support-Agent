"use client"

import { useState } from "react"

import { toTicket } from "@/lib/mock/from-service-request"
import type { Ticket } from "@/lib/mock/types"

interface UseServiceRequestActionsArgs {
  setTickets: (updater: (prev: Ticket[]) => Ticket[]) => void
  setSelectedTicketId: (id: string) => void
}

/**
 * Create-only: rename/delete were dropped from scope for the customer UI
 * (see `feature-specs/07-wire-ui-api.md`) even though the backend routes
 * exist — a customer editing/deleting their own case's audit trail doesn't
 * fit this app's servicing model.
 */
export function useServiceRequestActions({
  setTickets,
  setSelectedTicketId,
}: UseServiceRequestActionsArgs) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  function openCreate() {
    setIsCreateOpen(true)
  }

  function closeCreate() {
    setIsCreateOpen(false)
    setTitle("")
  }

  async function createTicket() {
    const trimmed = title.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!response.ok) return

      const { serviceRequest } = await response.json()
      const newTicket = toTicket(serviceRequest)
      setTickets((prev) => [newTicket, ...prev])
      setSelectedTicketId(newTicket.id)
      closeCreate()
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isCreateOpen,
    openCreate,
    closeCreate,
    setIsCreateOpen,
    title,
    setTitle,
    isSubmitting,
    createTicket,
  }
}
