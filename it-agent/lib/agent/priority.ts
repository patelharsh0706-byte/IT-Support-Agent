import { ISSUE_CATALOG, type Issue, type Priority } from "./intents"

/**
 * Priority is decided here, in plain code — never by the model.
 *
 * `context/project-overview.md`: "Priority is the issue's declared default and
 * may be raised by the classifier's severity signals; it is never lowered."
 */

const RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2 }

/** Phrases that raise priority one band. Deterministic, and each names itself. */
const SEVERITY_SIGNALS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(fraud|fraudulent|stolen|unauthoris?ed|someone else used)\b/i, reason: "Fraud language" },
  { pattern: /\b(closed my (account|card)|cancel(ling|ing)? my card|leaving amex)\b/i, reason: "Stated churn" },
  { pattern: /\b(regulator|ombudsman|legal action|lawyer|the press)\b/i, reason: "Regulator or legal threat" },
  { pattern: /\b(stranded|abroad|emergency|urgent(ly)?|medical)\b/i, reason: "Stated urgency" },
]

export interface PriorityDecision {
  priority: Priority
  /** The issue's declared default, before any signal. */
  base: Priority
  /** Every signal that fired, for the activity panel and the audit row. */
  reasons: string[]
}

export function decidePriority(issue: Issue, text: string): PriorityDecision {
  const base = ISSUE_CATALOG[issue].defaultPriority
  const reasons: string[] = []
  let priority = base

  for (const { pattern, reason } of SEVERITY_SIGNALS) {
    if (!pattern.test(text)) continue
    reasons.push(reason)
    // One band up, and only ever up.
    const raised: Priority = priority === "low" ? "medium" : "high"
    if (RANK[raised] > RANK[priority]) priority = raised
  }

  return { priority, base, reasons }
}
