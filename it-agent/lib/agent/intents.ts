/**
 * The servicing taxonomy: three intents, six issues, one `other`.
 *
 * Source of truth is `context/project-overview.md`'s Intents and Issues table.
 * The intent codes match `service_request.intent`'s enum exactly, so a
 * classification result can be written to the column without translation.
 */

/** Matches the `service_request.intent` column enum. */
export const INTENTS = [
  "card_unblock_activation",
  "unrecognized_transaction",
  "update_contact_info",
] as const
export type Intent = (typeof INTENTS)[number]

/**
 * The six issues, finer-grained than intent. There is no `issue` column yet —
 * a later migration adds one (see the plan's deferred list). Until then the
 * issue lives only in the classification result and the audit trail.
 */
export const ISSUES = [
  "card_unblock",
  "card_activation",
  "unrecognized_transaction",
  "duplicate_charge",
  "update_phone",
  "update_email",
] as const
export type Issue = (typeof ISSUES)[number]

/** Anything outside the six. Never reaches a tool; always escalates. */
export const OTHER = "other" as const
export type IssueOrOther = Issue | typeof OTHER

export type Priority = "low" | "medium" | "high"

interface IssueDefinition {
  intent: Intent
  /** The declared default from the overview's table. May be raised, never lowered. */
  defaultPriority: Priority
  /** Human label, for prompts and the activity panel. */
  label: string
  /**
   * False when the schema cannot express the action yet. An unimplemented
   * issue classifies correctly and then escalates, rather than pretending.
   */
  implemented: boolean
  /** Why it is not implemented — surfaced in the escalation reason. */
  blockedBy?: string
}

export const ISSUE_CATALOG: Record<Issue, IssueDefinition> = {
  card_unblock: {
    intent: "card_unblock_activation",
    defaultPriority: "high",
    label: "Card Unblock",
    implemented: true,
  },
  card_activation: {
    intent: "card_unblock_activation",
    defaultPriority: "medium",
    label: "Card Activation",
    implemented: true,
  },
  update_email: {
    intent: "update_contact_info",
    defaultPriority: "low",
    label: "Update Email",
    implemented: true,
  },
  unrecognized_transaction: {
    intent: "unrecognized_transaction",
    defaultPriority: "high",
    label: "Unrecognized Transaction",
    implemented: true,
  },
  duplicate_charge: {
    intent: "unrecognized_transaction",
    defaultPriority: "medium",
    label: "Duplicate Charge",
    implemented: true,
  },
  update_phone: {
    intent: "update_contact_info",
    defaultPriority: "medium",
    label: "Update Phone Number",
    implemented: true,
  },
}

export function isIssue(value: unknown): value is Issue {
  return typeof value === "string" && (ISSUES as readonly string[]).includes(value)
}

export function intentForIssue(issue: Issue): Intent {
  return ISSUE_CATALOG[issue].intent
}

export const IMPLEMENTED_ISSUES = ISSUES.filter((i) => ISSUE_CATALOG[i].implemented)
