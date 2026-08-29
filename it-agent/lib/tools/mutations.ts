/**
 * What a mutating tool changed, recorded as it happens.
 *
 * Verification (Invariant 2) needs to know what to re-check. Reading that back
 * out of the AI SDK's step objects would couple us to an internal shape that
 * has already moved between major versions. Instead each mutating tool reports
 * its own effect through a callback the pipeline owns, and the pipeline
 * verifies from that. Deterministic, and independent of the SDK.
 *
 * This is a record of *intent to have changed something*, not proof — the
 * whole point of the verifier is that it re-reads the database independently.
 */
export type Mutation =
  | { kind: "card_status"; lastFour: string; expected: "active" | "frozen" | "inactive" }
  | { kind: "email"; expected: string }
  | { kind: "phone"; expected: string }
  | { kind: "dispute"; transactionId: string }

export type MutationRecorder = (mutation: Mutation) => void

/**
 * What the verifier will re-read, keyed by target rather than appended.
 *
 * The tool loop can write the same target twice in one turn — two
 * `update_email` calls, or a card frozen and then unfrozen. Verification runs
 * once, after the loop, so a plain append would have it check the *first*
 * expected value against the *final* stored one and escalate a turn whose last
 * write succeeded. Only the latest write per target is a claim about the end
 * state, so only that one is kept.
 */
function targetOf(mutation: Mutation): string {
  switch (mutation.kind) {
    case "card_status":
      return `card_status:${mutation.lastFour}`
    case "dispute":
      return `dispute:${mutation.transactionId}`
    default:
      return mutation.kind
  }
}

export function createMutationLog() {
  const byTarget = new Map<string, Mutation>()
  const record: MutationRecorder = (mutation) => {
    // Map preserves insertion order, so re-recording a target keeps its
    // original position and the activity log still reads in the order the
    // tools ran.
    byTarget.set(targetOf(mutation), mutation)
  }
  return {
    get mutations(): Mutation[] {
      return [...byTarget.values()]
    },
    record,
  }
}
