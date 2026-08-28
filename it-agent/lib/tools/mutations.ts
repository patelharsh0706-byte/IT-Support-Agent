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

export type MutationRecorder = (mutation: Mutation) => void

export function createMutationLog() {
  const mutations: Mutation[] = []
  const record: MutationRecorder = (m) => void mutations.push(m)
  return { mutations, record }
}
