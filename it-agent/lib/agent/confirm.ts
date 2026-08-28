import { generateText, type LanguageModel } from "ai"

import { servicingModel } from "./provider"
import { ISSUE_CATALOG } from "./intents"
import type { Classification } from "./classify"
import type { decidePriority } from "./priority"

/**
 * LLM call 2 of 2: turn a settled outcome into a sentence for the customer.
 *
 * The model is a writer here, not a decider. Everything it describes has
 * already happened and already been verified — it is told the outcome and
 * asked to phrase it. It cannot claim success for something that failed,
 * because the outcome is in the prompt, not in its judgement.
 */

export interface ComposeInput {
  outcome: "resolved" | "initiated" | "escalated"
  classification: Classification
  priority: ReturnType<typeof decidePriority> | null
  /** Verification detail, or the escalation reason. */
  context: string
  model?: LanguageModel
}

const SYSTEM_PROMPT = `You write one short reply to an American Express cardholder, in plain British English.

Rules:
- Two or three sentences. No greeting, no sign-off, no bullet points.
- State only what the outcome says happened. Never claim an action that is not in the outcome.
- Never state account numbers, balances, or amounts.
- If the outcome is escalated, say plainly that a colleague will pick it up, and why, without blaming the customer.
- If the outcome is initiated, this is a dispute: the charge is suspended and an investigation has opened. Say that clearly. Do NOT say the issue is resolved, fixed or refunded — it is not, and saying so would be untrue.
- Do not promise a timescale unless one is given to you.`

export async function composeReply(input: ComposeInput): Promise<string> {
  const label =
    input.classification.issue === "other"
      ? "an unsupported request"
      : ISSUE_CATALOG[input.classification.issue].label

  const outcomeBrief = [
    `Outcome: ${input.outcome}.`,
    `Request type: ${label}.`,
    input.priority ? `Priority: ${input.priority.priority}.` : null,
    `Detail: ${input.context}`,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const { text } = await generateText({
      model: input.model ?? servicingModel(),
      system: SYSTEM_PROMPT,
      prompt: outcomeBrief,
    })
    return text.trim()
  } catch {
    // The turn already succeeded or failed on its own terms; a writing failure
    // must not change the outcome. Fall back to a plain deterministic sentence.
    return fallbackReply(input)
  }
}

/** Used when the model is unavailable. Says the same thing, less warmly. */
export function fallbackReply(input: ComposeInput): string {
  if (input.outcome === "initiated") {
    return "We've suspended that charge and opened an investigation. These take 30 to 90 days, and we'll come back to you here with the outcome."
  }
  return input.outcome === "resolved"
    ? "That's now sorted on your account. If anything still looks wrong, reply here and we'll take another look."
    : "We haven't been able to complete this automatically, so a colleague will pick it up and come back to you here."
}
