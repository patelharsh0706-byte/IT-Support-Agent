/**
 * A public reply under the brand's name is subject to two constraints
 * regardless of what an admin types.
 *
 * This is a **block, not a warning**. An admin who needs to discuss specifics
 * moves to DM or the case thread. The intended shape of a public reply is
 * acknowledge plus handoff to a secure channel — see
 * `feature-specs/09-tweet-fetch-agent.md`.
 */

/** X's post limit for a standard (non-premium) account. */
export const MAX_TWEET_LENGTH = 280

export interface GuardViolation {
  /** Named so the rejection is fixable rather than mysterious. */
  rule: string
  message: string
}

export type GuardResult =
  | { ok: true }
  | { ok: false; violations: GuardViolation[] }

/** Digit runs long enough to be a card or account number, ignoring separators. */
const DIGIT_RUN = /(?:\d[ -]?){12,}/
/** A 3–4 digit group introduced as a security code. */
const CVV = /\b(?:cvv|cvc|security code|pin)\b\D{0,10}\d{3,4}\b/i
/**
 * Currency amounts — a public reply must not confirm balances or charges.
 *
 * Three shapes, because staff write all three: a symbol (`$214.50`), a
 * currency code before the number (`USD 100`), and a bare decimal amount
 * (`214.50`). The code-prefixed form was the gap — "We refunded USD 100" was
 * publishable.
 */
const AMOUNT =
  /(?:[$€£¥]\s?\d|\b(?:usd|eur|gbp|sgd|inr|aud|cad|jpy|chf)\s?\d[\d,]*(?:\.\d{2})?\b|(?:\b\d[\d,]*\.\d{2}\b)\s?(?:usd|eur|gbp|sgd|inr|aud|cad|jpy|chf)?)/i
const BALANCE = /\b(?:balance|statement balance|available credit|credit limit)\b/i
/** Transaction and case identifiers. */
const TXN_ID = /\b(?:txn|transaction|auth|reference|ref|case)\s*(?:id|no|number|#)?\s*[:#]?\s*[a-z0-9-]{6,}\b/i
/** The last-four pattern staff reflexively reach for. */
const LAST_FOUR = /\b(?:ending|last\s*4|last\s*four)\b\D{0,10}\d{4}\b/i

const RULES: { rule: string; pattern: RegExp; message: string }[] = [
  {
    rule: "card-number",
    pattern: DIGIT_RUN,
    message: "Looks like a card or account number. Never post one publicly.",
  },
  {
    rule: "last-four",
    pattern: LAST_FOUR,
    message: "Card digits, even the last four, do not belong in a public reply.",
  },
  {
    rule: "security-code",
    pattern: CVV,
    message: "Security codes and PINs must never appear anywhere, least of all publicly.",
  },
  {
    rule: "amount",
    pattern: AMOUNT,
    message: "Confirming an amount publicly discloses account activity.",
  },
  {
    rule: "balance",
    pattern: BALANCE,
    message: "Balances and credit limits are account specifics — move to a secure channel.",
  },
  {
    rule: "transaction-id",
    pattern: TXN_ID,
    message: "Transaction and case identifiers are account specifics.",
  },
]

export function checkReply(text: string): GuardResult {
  const violations: GuardViolation[] = []
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    violations.push({ rule: "empty", message: "A reply cannot be empty." })
  }

  // Length is enforced here as well as in the composer: a reply truncated by
  // the platform mid-sentence is a worse look than one that was never sent.
  if (text.length > MAX_TWEET_LENGTH) {
    violations.push({
      rule: "length",
      message: `Reply is ${text.length} characters; the limit is ${MAX_TWEET_LENGTH}.`,
    })
  }

  for (const { rule, pattern, message } of RULES) {
    if (pattern.test(text)) violations.push({ rule, message })
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations }
}
