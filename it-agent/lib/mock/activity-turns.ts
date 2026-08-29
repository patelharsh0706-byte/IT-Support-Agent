import type { ActivityEvent } from "./types"

/**
 * Groups a flat activity log into the turns that produced it.
 *
 * The panel used to render one long undifferentiated list, so three separate
 * conversations with the agent looked like one run of eighteen steps. A turn
 * is the unit a CSR actually reasons about: "what did the agent do when the
 * customer said that?"
 */

export type TurnOutcome = "resolved" | "escalated" | "failed" | "running"

export interface ActivityTurn {
  id: string
  /** First event's timestamp — when the customer's message landed. */
  startedAt: string
  endedAt: string
  /** Chronological within the turn: a turn read backwards is nonsense. */
  events: ActivityEvent[]
  outcome: TurnOutcome
}

/**
 * Events inside one turn land seconds apart; separate turns are minutes or
 * hours apart. Splitting on a time gap rather than on stage names means this
 * also groups older rows correctly — seeded fixtures and anything written
 * before the current pipeline existed use different stage vocabulary.
 *
 * 2 minutes is comfortably above a slow turn (the route caps at 60s) and
 * comfortably below the gap between two real messages.
 */
const DEFAULT_GAP_MS = 120_000

function outcomeOf(events: ActivityEvent[]): TurnOutcome {
  // Read from the end: the last thing that happened decides how it ended.
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (event.stage === "escalate" || event.status === "denied") return "escalated"
    if (event.status === "failed") return "failed"
    if (event.stage === "confirm" && event.status === "ok") return "resolved"
  }
  return events.some((e) => e.status === "running") ? "running" : "resolved"
}

/**
 * Newest turn first, because the CSR wants the most recent exchange without
 * scrolling. Within a turn the order stays chronological so the agent's
 * reasoning reads top to bottom as it happened.
 */
export function groupActivityIntoTurns(
  events: ActivityEvent[],
  gapMs = DEFAULT_GAP_MS,
): ActivityTurn[] {
  if (events.length === 0) return []

  const chronological = [...events].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
  )

  const groups: ActivityEvent[][] = []
  let current: ActivityEvent[] = []

  for (const event of chronological) {
    const previous = current[current.length - 1]
    const gap = previous
      ? new Date(event.timestamp).getTime() - new Date(previous.timestamp).getTime()
      : 0
    // `classify` + `running` is the pipeline's own first emit, so it is an
    // exact turn boundary. Matching on the stage alone would split a turn at
    // its own `classify`/`ok` a moment later. The gap rule covers rows written
    // by anything that does not emit that marker.
    const startsNewTurn =
      previous !== undefined &&
      (gap > gapMs || (event.stage === "classify" && event.status === "running"))

    if (startsNewTurn) {
      groups.push(current)
      current = []
    }
    current.push(event)
  }
  if (current.length > 0) groups.push(current)

  return groups
    .map((turnEvents) => ({
      id: turnEvents[0].id,
      startedAt: turnEvents[0].timestamp,
      endedAt: turnEvents[turnEvents.length - 1].timestamp,
      events: turnEvents,
      outcome: outcomeOf(turnEvents),
    }))
    .reverse()
}
