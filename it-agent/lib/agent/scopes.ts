import type { ToolSet } from "ai"

import { createCardTools } from "@/lib/tools/cards"
import type { MutationRecorder } from "@/lib/tools/mutations"
import { createProfileTools } from "@/lib/tools/profile"
import { createTransactionTools } from "@/lib/tools/transactions"
import { ISSUE_CATALOG, type Intent, type Issue } from "./intents"

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

/**
 * The scope is keyed on the **issue**, not only the intent.
 *
 * Three issues share the `card_unblock_activation` intent, and one of them —
 * `report_lost_stolen` — is the opposite of the other two. Scoping at intent
 * level handed a stolen-card turn the tool to unblock the card the customer
 * had just reported gone. The prompt said not to; the prompt is not a boundary.
 */
export function toolsForIssue(
  issue: Issue,
  customerId: string,
  record: MutationRecorder = () => {},
): ScopedToolSet {
  if (issue === "report_lost_stolen") {
    return createCardTools(customerId, record, "report_lost_stolen")
  }
  return toolsForIntent(ISSUE_CATALOG[issue].intent, customerId, record)
}

export function toolsForIntent(
  intent: Intent,
  customerId: string,
  record: MutationRecorder = () => {},
): ScopedToolSet {
  switch (intent) {
    case "card_unblock_activation":
      return createCardTools(customerId, record, "servicing")

    case "update_contact_info":
      return createProfileTools(customerId, record)

    case "unrecognized_transaction":
      return createTransactionTools(customerId, record)

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

/** Tool names in an issue's scope — the granularity the pipeline actually uses. */
export function toolNamesForIssue(issue: Issue, customerId = "scope-probe"): string[] {
  return Object.keys(toolsForIssue(issue, customerId)).sort()
}
