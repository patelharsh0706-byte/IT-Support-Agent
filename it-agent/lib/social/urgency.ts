import type { RawTweet } from "./tweet-source"
import type { Urgency } from "./types"

/**
 * The grievance gate and the urgency score, both deterministic. No model call
 * in this unit.
 *
 * `scoreTweet()` is the single swap point — the role `buildCaseThread()`
 * played in unit 08. When a classifier exists it replaces this body and
 * nothing above or below changes. The rule version stays as the fallback
 * when a model call fails, so the feed is never blank because an API was
 * down.
 */

/** A grievance older than this and still unreplied is `high`. */
export const AGED_GRIEVANCE_HOURS = 24
/** Reach above either threshold makes a grievance `high`. */
export const REACH_LIKES = 25
export const REACH_REPLIES = 5

const PROBLEM_MARKERS = [
  "blocked", "declined", "locked", "frozen", "stuck", "still waiting", "no one",
  "nobody", "never", "not working", "cannot", "can't", "won't", "failed",
  "unable", "chasing", "no response", "no reply", "ignored", "useless",
  "terrible", "awful", "worst", "disgraceful", "unacceptable", "complaint",
  "issue", "problem", "error", "wrong", "missing", "refund", "dispute",
  "charged", "overcharged", "delay", "delayed", "still open", "escalate",
]

const PRAISE_MARKERS = [
  "thank", "thanks", "grateful", "impressed", "excellent", "amazing",
  "best service", "love", "brilliant", "shout out", "shoutout", "kudos",
  "well done", "great service", "sorted it", "resolved it quickly",
]

const MARKETING_MARKERS = [
  "roundup", "announces", "announced", "partnership", "expanding", "launches",
  "launched", "report:", "analysis:", "sponsored", "webinar", "press release",
]

// Deliberately matches "closed the card" as well as "closed my card": the
// determiner varies and the meaning does not. A too-narrow list here reads a
// churned customer as a routine complaint, which is the single most expensive
// miss this product can make.
const CLOSURE_MARKERS = [
  "closed my card", "closed the card", "closed my account", "closed the account",
  "cancelled my card", "cancelled the card", "canceling my card", "cancelling my card",
  "cancelled my account", "closing my account", "closing the account",
  "cutting up my card", "moved to another", "moved everything to another",
  "moving to another", "switching to another", "switched to another",
  "another issuer", "different issuer", "left amex", "leaving amex",
]

const REGULATOR_MARKERS = [
  "regulator", "ombudsman", "cfpb", "monetary authority", "mas ", "fca",
  "file a complaint with", "legal action", "lawyer", "small claims",
  "the press", "journalist", "consumer protection",
]

const FRAUD_MARKERS = [
  "did not make", "didn't make", "did not authorise", "did not authorize",
  "didn't authorise", "didn't authorize", "unauthorised", "unauthorized",
  "fraud", "fraudulent", "stolen", "someone used my", "money is missing",
  "money missing", "still missing", "charged twice", "posted twice",
  "duplicate charge",
]

function hits(haystack: string, markers: string[]): boolean {
  return markers.some((m) => haystack.includes(m))
}

/**
 * Is this a complaint at all? Cheap, and wrong sometimes — but a false
 * negative still appears in the feed, just without an urgency badge, so a
 * miss costs visibility rather than losing the tweet.
 */
export function isGrievance(tweet: Pick<RawTweet, "text">): boolean {
  const text = tweet.text.toLowerCase()

  // Fraud and closure language is a grievance regardless of how politely
  // it is phrased, so it is checked before the praise veto.
  if (hits(text, FRAUD_MARKERS) || hits(text, CLOSURE_MARKERS)) return true
  if (hits(text, REGULATOR_MARKERS)) return true

  if (hits(text, PRAISE_MARKERS)) return false
  if (hits(text, MARKETING_MARKERS)) return false

  return hits(text, PROBLEM_MARKERS)
}

const RANK: Record<Urgency, number> = { normal: 0, high: 1, critical: 2 }

export interface TweetScore {
  isGrievance: boolean
  urgency: Urgency
  /** Why, in plain words — rendered on the row so the mark is trustable. */
  reasons: string[]
}

export interface ScoreContext {
  /** Handles already in the feed, for the repeat-post rule. */
  knownHandles?: Set<string>
  /** Overridable so tests are not clock-dependent. */
  now?: Date
}

/**
 * Rules only ever raise the level, never lower it — mirroring R4's one-way
 * severity rule in the social intake plan. Every rule that fires contributes
 * a reason.
 */
export function scoreTweet(tweet: RawTweet, context: ScoreContext = {}): TweetScore {
  const grievance = isGrievance(tweet)
  const reasons: string[] = []
  let urgency: Urgency = "normal"

  function raise(to: Urgency, reason: string) {
    reasons.push(reason)
    if (RANK[to] > RANK[urgency]) urgency = to
  }

  if (!grievance) {
    return { isGrievance: false, urgency: "normal", reasons: [] }
  }

  const text = tweet.text.toLowerCase()

  if (hits(text, CLOSURE_MARKERS)) raise("critical", "Customer states they closed or left")
  if (hits(text, REGULATOR_MARKERS)) raise("critical", "Threatens regulator, legal action or press")
  if (hits(text, FRAUD_MARKERS)) raise("critical", "Fraud, unauthorised charge or missing money")

  const now = context.now ?? new Date()
  const ageHours = (now.getTime() - new Date(tweet.postedAt).getTime()) / 3_600_000
  if (ageHours >= AGED_GRIEVANCE_HOURS) {
    raise("high", `Unanswered for ${Math.floor(ageHours)} hours`)
  }

  if (context.knownHandles?.has(tweet.authorHandle)) {
    raise("high", "Repeat post from a handle already in the feed")
  }

  if (tweet.likeCount >= REACH_LIKES || tweet.replyCount >= REACH_REPLIES) {
    raise("high", `Reach: ${tweet.likeCount} likes, ${tweet.replyCount} replies`)
  }

  return { isGrievance: true, urgency, reasons }
}
