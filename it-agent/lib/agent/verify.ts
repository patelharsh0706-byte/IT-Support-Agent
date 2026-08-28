import { verifyCardStatus } from "@/lib/tools/cards"
import type { Mutation } from "@/lib/tools/mutations"
import { verifyEmail } from "@/lib/tools/profile"

/**
 * Invariant 2: "Every executed tool call is verified — an independent,
 * read-only re-check of state — before the agent confirms resolution. The
 * action tool is never its own witness."
 *
 * None of these verifiers is exposed to the model. They are called by the
 * pipeline, after the loop, and they re-read the database rather than trusting
 * what a tool reported.
 */

export interface VerificationResult {
  matched: boolean
  detail: string
}

export async function verifyMutation(
  customerId: string,
  mutation: Mutation,
): Promise<VerificationResult> {
  if (mutation.kind === "card_status") {
    const result = await verifyCardStatus(customerId, mutation.lastFour, mutation.expected)
    return {
      matched: result.matched,
      detail: result.matched
        ? `Card ending ${mutation.lastFour} re-read as ${result.observed}.`
        : `Card ending ${mutation.lastFour} reads ${result.observed ?? "missing"}, expected ${result.expected}.`,
    }
  }

  const result = await verifyEmail(customerId, mutation.expected)
  return {
    matched: result.matched,
    detail: result.matched
      ? `Email re-read as ${result.observed}.`
      : `Email reads ${result.observed ?? "missing"}, expected ${result.expected}.`,
  }
}

export async function verifyAll(
  customerId: string,
  mutations: Mutation[],
): Promise<VerificationResult[]> {
  return Promise.all(mutations.map((m) => verifyMutation(customerId, m)))
}
