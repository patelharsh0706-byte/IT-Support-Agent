import { tool } from "ai"
import { z } from "zod"

import {
  getTransactionForCustomer,
  listTransactionsForCustomer,
  markTransactionDisputed,
} from "@/lib/sqlite/queries"
import type { MutationRecorder } from "./mutations"

/**
 * Transaction & Dispute tools.
 *
 * Same trust boundary as the others: no schema accepts a customer id, and
 * every query is scoped by the session-resolved one, so another customer's
 * charge is not found rather than found-and-refused.
 *
 * **A dispute is initiated, not resolved.** Under Regulation Z a valid dispute
 * suspends the charge and opens an investigation running 30-90 days. These
 * tools therefore mark a charge `disputed`; nothing here reverses it, because
 * a reversal is the *outcome* of an investigation and is not the agent's to
 * make (`context/project-overview.md`, Dispute terminal state).
 */

function money(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`
}

export function createTransactionTools(
  customerId: string,
  record: MutationRecorder = () => {},
) {
  return {
    get_transactions: tool({
      description:
        "List the signed-in customer's recent card transactions, newest first. Call this to find the charge the customer means before disputing anything.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await listTransactionsForCustomer(customerId)
        return {
          transactions: rows.map((t) => ({
            id: t.id,
            merchant: t.merchant,
            amount: money(t.amountMinor, t.currency),
            postedAt: t.postedAt,
            status: t.status,
          })),
        }
      },
    }),

    initiate_dispute: tool({
      description:
        "Open a dispute on one charge. This suspends the charge and starts an investigation; it does not refund the money. Use the transaction id from get_transactions.",
      inputSchema: z.object({
        transactionId: z.string().min(1, "The id from get_transactions"),
        reason: z.string().min(3, "The customer's stated reason, in their words"),
      }),
      execute: async ({ transactionId, reason }) => {
        const txn = await getTransactionForCustomer(customerId, transactionId)
        if (!txn) {
          return { ok: false as const, reason: "No such transaction on this account." }
        }
        if (txn.status === "disputed") {
          return {
            ok: false as const,
            reason: `That charge is already under dispute (opened ${txn.disputedAt}).`,
          }
        }
        if (txn.status === "reversed") {
          return { ok: false as const, reason: "That charge has already been reversed." }
        }

        const updated = await markTransactionDisputed(customerId, transactionId, reason)
        if (!updated) return { ok: false as const, reason: "Could not open the dispute." }

        record({ kind: "dispute", transactionId })
        return {
          ok: true as const,
          status: updated.status,
          note: "Charge suspended and an investigation opened. Investigations take 30 to 90 days.",
        }
      },
    }),
  }
}

/** Independent read-only verifier. Not exposed to the model. */
export async function verifyDispute(customerId: string, transactionId: string) {
  const txn = await getTransactionForCustomer(customerId, transactionId)
  return {
    matched: txn?.status === "disputed",
    observed: txn?.status ?? null,
    expected: "disputed" as const,
  }
}
