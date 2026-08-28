import type { ToolSet } from "ai"

import { createCardTools } from "@/lib/tools/cards"
import type { MutationRecorder } from "@/lib/tools/mutations"
import { createProfileTools } from "@/lib/tools/profile"
import type { Intent } from "./intents"

/**
 * Invariant 3, enforced by construction.
 *
 * The gate decides *which tools the model is handed at all*, rather than
 * checking after a call is attempted. A Card Servicing turn is never given a
 * profile tool, so an out-of-scope call cannot be made — there is nothing to
 * reject, because there was nothing to call.
 *
 * `context/architecture.md`: "The authorization gate in front of every tool
 * call, not a framework boundary, is what stops a Card Servicing turn from
 * executing a Dispute tool."
 */

export type ScopedToolSet = ToolSet

export function toolsForIntent(
  intent: Intent,
  customerId: string,
  record: MutationRecorder = () => {},
): ScopedToolSet {
  switch (intent) {
    case "card_unblock_activation":
      return createCardTools(customerId, record)

    case "update_contact_info":
      return createProfileTools(customerId, record)

    case "unrecognized_transaction":
      // No dispute tools exist yet — the schema has no transactions table.
      // An empty scope means the pipeline escalates rather than improvising.
      return {}

    default: {
      const exhaustive: never = intent
      throw new Error(`Unhandled intent: ${String(exhaustive)}`)
    }
  }
}

/** Tool names in an intent's scope, for the audit trail and tests. */
export function toolNamesForIntent(intent: Intent, customerId = "scope-probe"): string[] {
  return Object.keys(toolsForIntent(intent, customerId)).sort()
}
