import type { Intent } from "./types"

/**
 * Customer-facing servicing area for each supported intent. Shared by the
 * chat header and the ticket status panel so both name an intent the same way.
 */
export const intentLabel: Record<Intent, string> = {
  card_unblock_activation: "Card Servicing",
  unrecognized_transaction: "Transaction & Dispute Servicing",
  update_contact_info: "Account & Profile Servicing",
}

/** Intent is nullable in the real schema — fall back rather than render blank. */
export function intentLabelFor(intent: Intent | null | undefined) {
  return intent ? intentLabel[intent] : "General Servicing"
}
