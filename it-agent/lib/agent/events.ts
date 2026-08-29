/**
 * One event type, two destinations: streamed to the Agent Activity panel and
 * persisted to `agent_actions`. The pipeline emits; it does not know or care
 * who is listening.
 */

/** The stages of a servicing turn, in order. */
export type ActivityStage =
  | "classify"
  | "prioritize"
  | "authorize"
  | "execute"
  | "verify"
  | "confirm"
  | "escalate"

/** Matches the `agent_actions.status` enum exactly, so an event maps to a row. */
export type ActivityStatus = "running" | "ok" | "failed" | "denied"

export interface ActivityEvent {
  stage: ActivityStage
  status: ActivityStatus
  /** Plain words. This is what a CSR reads in the panel. */
  detail: string
  at: string
}

export type Emit = (event: ActivityEvent) => void | Promise<void>

export function activityEvent(
  stage: ActivityStage,
  status: ActivityStatus,
  detail: string,
): ActivityEvent {
  return { stage, status, detail, at: new Date().toISOString() }
}

/** Used when a caller does not care about telemetry (tests, scripts). */
export const noopEmit: Emit = () => {}
