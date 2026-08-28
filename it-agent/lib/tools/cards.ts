import { tool } from "ai"
import { z } from "zod"

import {
  getCardForCustomer,
  listCardsForCustomer,
  setCardStatus,
} from "@/lib/sqlite/queries"
import type { MutationRecorder } from "./mutations"

/**
 * Card Servicing tools.
 *
 * **Invariant 1 is structural here.** No schema below accepts a customer id,
 * so a model cannot supply one. Each `execute` closes over `customerId`,
 * resolved from the authenticated session by the caller. A hallucinated or
 * injected id has nowhere to go — there is no parameter for it.
 *
 * Tool inputs are limited to `lastFour`, and every query is scoped by
 * `customerId AND lastFour`, so another customer's card is *not found* rather
 * than found-and-refused.
 */

const lastFour = z
  .string()
  .regex(/^\d{4}$/, "The last four digits of the card, e.g. 4821")

export function createCardTools(customerId: string, record: MutationRecorder = () => {}) {
  return {
    get_cards: tool({
      description:
        "List the signed-in customer's cards with their current status. Call this first to find the card the customer means.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await listCardsForCustomer(customerId)
        return { cards: rows }
      },
    }),

    unblock_card: tool({
      description:
        "Unblock (unfreeze) a frozen card so it can be used again. Only valid when the card's status is 'frozen'.",
      inputSchema: z.object({ lastFour }),
      execute: async ({ lastFour }) => {
        const card = await getCardForCustomer(customerId, lastFour)
        if (!card) {
          return { ok: false as const, reason: `No card ending ${lastFour} on this account.` }
        }
        if (card.status === "active") {
          return { ok: false as const, reason: `Card ending ${lastFour} is already active.` }
        }
        if (card.status !== "frozen") {
          return {
            ok: false as const,
            reason: `Card ending ${lastFour} is ${card.status}, not frozen. Activation is a different action.`,
          }
        }
        const updated = await setCardStatus(customerId, lastFour, "active")
        if (updated) record({ kind: "card_status", lastFour, expected: "active" })
        return { ok: updated !== null, status: updated?.status }
      },
    }),

    activate_card: tool({
      description:
        "Activate a newly issued card that has never been used. Only valid when the card's status is 'inactive'.",
      inputSchema: z.object({ lastFour }),
      execute: async ({ lastFour }) => {
        const card = await getCardForCustomer(customerId, lastFour)
        if (!card) {
          return { ok: false as const, reason: `No card ending ${lastFour} on this account.` }
        }
        if (card.status === "active") {
          return { ok: false as const, reason: `Card ending ${lastFour} is already active.` }
        }
        if (card.status !== "inactive") {
          return {
            ok: false as const,
            reason: `Card ending ${lastFour} is ${card.status}, not inactive. Unblocking is a different action.`,
          }
        }
        const updated = await setCardStatus(customerId, lastFour, "active")
        if (updated) record({ kind: "card_status", lastFour, expected: "active" })
        return { ok: updated !== null, status: updated?.status }
      },
    }),
  }
}

/**
 * The verifier, deliberately kept out of the model-facing tool set.
 *
 * Invariant 2: the action tool is never its own witness. The pipeline calls
 * this directly after a write, as an independent read, and compares against
 * the expected post-state. It is not offered to the model, so the model
 * cannot "verify" by asserting success.
 */
export async function verifyCardStatus(
  customerId: string,
  lastFour: string,
  expected: "active" | "frozen" | "inactive",
) {
  const card = await getCardForCustomer(customerId, lastFour)
  return {
    matched: card?.status === expected,
    observed: card?.status ?? null,
    expected,
  }
}
