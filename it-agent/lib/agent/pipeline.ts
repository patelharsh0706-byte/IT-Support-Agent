import { generateText, stepCountIs, type LanguageModel } from "ai"

import { createMutationLog } from "@/lib/tools/mutations"
import { classify, type Classification } from "./classify"
import { activityEvent, noopEmit, type Emit } from "./events"
import { ISSUE_CATALOG, type Intent } from "./intents"
import { decidePriority } from "./priority"
import { servicingModel } from "./provider"
import { toolsForIntent } from "./scopes"
import { verifyAll } from "./verify"

/**
 * The deterministic spine. Two model calls sit inside it — classification and
 * the closing sentence — and nothing else here asks a model anything.
 *
 * `context/architecture.md`: "Priority, routing, tool execution, and
 * verification are plain TypeScript — no model call, no framework state
 * machine. This is what makes the pipeline auditable, testable without
 * mocking a model, and fast enough for a live demo."
 */

/**
 * `initiated` is a dispute's terminal state and is deliberately not
 * `resolved`: under Regulation Z a valid dispute suspends the charge and opens
 * a 30-90 day investigation. Telling a customer their dispute is "resolved"
 * the moment it is raised would be untrue (`context/project-overview.md`).
 */
export type Outcome = "resolved" | "initiated" | "escalated"

/** Which intents end in an investigation rather than a completed action. */
function terminalOutcomeFor(intent: Intent): Extract<Outcome, "resolved" | "initiated"> {
  return intent === "unrecognized_transaction" ? "initiated" : "resolved"
}

export interface TurnResult {
  outcome: Outcome
  classification: Classification
  priority: ReturnType<typeof decidePriority> | null
  /** What the customer is told. */
  reply: string
  /** Present when escalated — the reason a human is needed. */
  escalationReason?: string
}

export interface TurnInput {
  /** Resolved from the session by the caller. Never from the model. */
  customerId: string
  message: string
  emit?: Emit
  /** Injectable for tests; defaults to the configured provider. */
  models?: { classifier?: LanguageModel; servicing?: LanguageModel }
  /**
   * Overrides the classification step entirely. Lets the pipeline's branching
   * be tested with no model at all — which is the point architecture.md makes
   * about the loop being "testable without mocking a model".
   */
  classifier?: (message: string) => Promise<Classification>
  /** Injectable so a test can assert on escalation without a second model call. */
  compose?: (result: Omit<TurnResult, "reply">) => Promise<string>
}

const MAX_STEPS = 6

export async function runServicingTurn(input: TurnInput): Promise<TurnResult> {
  const emit = input.emit ?? noopEmit
  const { customerId, message } = input

  // ---- 1. Classify (model call 1) -----------------------------------------
  await emit(activityEvent("classify", "running", "Reading the message."))

  let classification: Classification
  try {
    classification = input.classifier
      ? await input.classifier(message)
      : await classify(message, { model: input.models?.classifier })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await emit(activityEvent("classify", "failed", `Classification failed: ${detail}`))
    return escalate(input, null, null, "The classifier could not be reached.", emit)
  }

  const label = classification.issue === "other" ? "other" : ISSUE_CATALOG[classification.issue].label
  await emit(
    activityEvent(
      "classify",
      "ok",
      `${label} (confidence ${classification.confidence.toFixed(2)}). ${classification.reasoning}`,
    ),
  )

  // ---- 2. Gates, before anything can act ----------------------------------
  if (classification.issue === "other" || classification.intent === null) {
    const why = classification.belowThreshold
      ? "Not confident enough to act on this automatically."
      : "This is outside the issues the agent can service."
    return escalate(input, classification, null, why, emit)
  }

  if (classification.notImplemented) {
    return escalate(
      input,
      classification,
      null,
      `${label} is recognised but not serviceable yet — ${classification.blockedBy}.`,
      emit,
    )
  }

  // ---- 3. Priority: a lookup, not a judgement ------------------------------
  const priority = decidePriority(classification.issue, message)
  await emit(
    activityEvent(
      "prioritize",
      "ok",
      priority.reasons.length > 0
        ? `${priority.priority} (default ${priority.base}; raised by: ${priority.reasons.join(", ")})`
        : `${priority.priority} (issue default)`,
    ),
  )

  // ---- 4. Capability scope: which tools exist for this turn ----------------
  const { mutations, record } = createMutationLog()
  const tools = toolsForIntent(classification.intent, customerId, record)
  const toolNames = Object.keys(tools)

  if (toolNames.length === 0) {
    return escalate(input, classification, priority, "No servicing tools are in scope for this intent.", emit)
  }
  await emit(
    activityEvent("authorize", "ok", `In scope for this turn: ${toolNames.join(", ")}.`),
  )

  // ---- 5. Execute (the SDK's tool loop) ------------------------------------
  await emit(activityEvent("execute", "running", "Working on the request."))

  try {
    await generateText({
      model: input.models?.servicing ?? servicingModel(),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      system:
        "You are an American Express servicing agent acting for the signed-in cardholder. " +
        "Use the tools available to resolve the request. Look up current state before changing it. " +
        "Never ask for or accept an account identifier — you already act on the right account. " +
        "If the tools cannot resolve it, say so plainly rather than inventing an outcome.\n\n" +
        // Disputing both halves of a duplicated pair claims back money the
        // customer genuinely owes for one purchase. Only the extra charge is
        // disputable.
        "For a duplicate charge, the customer made the purchase once and was billed twice. " +
        "Dispute only ONE of the identical charges — the later of the pair — and leave the other " +
        "standing, because the customer does owe for one. Never dispute both.\n" +
        "For an unrecognised charge, dispute only the specific charge the customer names. " +
        "Never dispute a charge the customer has not raised.",
      prompt: message,
      onStepFinish: async ({ toolCalls }) => {
        for (const call of toolCalls ?? []) {
          await emit(activityEvent("execute", "ok", `Called ${call.toolName}.`))
        }
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await emit(activityEvent("execute", "failed", detail))
    return escalate(input, classification, priority, `Execution failed: ${detail}`, emit)
  }

  if (mutations.length === 0) {
    await emit(activityEvent("execute", "ok", "No change was made."))
    return escalate(
      input,
      classification,
      priority,
      "The agent did not complete an action for this request.",
      emit,
    )
  }

  // ---- 6. Verify independently (Invariant 2) ------------------------------
  await emit(activityEvent("verify", "running", "Re-checking the account."))
  const verifications = await verifyAll(customerId, mutations)
  const failed = verifications.filter((v) => !v.matched)

  for (const v of verifications) {
    await emit(activityEvent("verify", v.matched ? "ok" : "failed", v.detail))
  }

  if (failed.length > 0) {
    return escalate(
      input,
      classification,
      priority,
      `Verification failed: ${failed.map((f) => f.detail).join(" ")}`,
      emit,
    )
  }

  // ---- 7. Terminal state, then confirm (model call 2) ---------------------
  const outcome = terminalOutcomeFor(classification.intent)
  await emit(
    activityEvent(
      "confirm",
      "running",
      outcome === "initiated"
        ? "Charge suspended and an investigation opened — this is not a resolution."
        : "Action completed and verified.",
    ),
  )
  const partial = { outcome, classification, priority }
  const reply = await compose(input, partial, verifications.map((v) => v.detail).join(" "))
  await emit(activityEvent("confirm", "ok", "Confirmed to the customer."))

  return { ...partial, reply }
}

async function escalate(
  input: TurnInput,
  classification: Classification | null,
  priority: TurnResult["priority"],
  reason: string,
  emit: Emit,
): Promise<TurnResult> {
  await emit(activityEvent("escalate", "denied", reason))
  const partial = {
    outcome: "escalated" as const,
    classification: classification ?? fallbackClassification(),
    priority,
    escalationReason: reason,
  }
  const reply = await compose(input, partial, reason)
  return { ...partial, reply }
}

function fallbackClassification(): Classification {
  return {
    issue: "other",
    intent: null,
    confidence: 0,
    params: {},
    reasoning: "Classification did not complete.",
    belowThreshold: true,
    notImplemented: false,
  }
}

/** Model call 2, or the injected stand-in. */
async function compose(
  input: TurnInput,
  partial: Omit<TurnResult, "reply">,
  context: string,
): Promise<string> {
  if (input.compose) return input.compose(partial)
  const { composeReply } = await import("./confirm")
  return composeReply({ ...partial, context, model: input.models?.servicing })
}
