# 09 — Tweet fetch agent

Fetches tweets that mention the brand, puts them in front of an admin, and
lets that admin reply from the console — the reply is posted to X as a real
reply to the original tweet.

Three questions, answered without leaving the dashboard:

1. **What is surfacing on social right now?** — every brand mention, newest
   first, with author, text, time, and a link to the post.
2. **Which of these needs a reply immediately?** — the ones that read as
   grievances get an urgency signal and sort to the top.
3. **Can I answer it here?** — yes. Type a reply, confirm, it posts.

Understanding *what kind* of grievance a tweet is — intent, issue, taxonomy —
is **not** in this unit. See *Deferred*.

Unlike `01`–`08`, this spec is written **before** the code, not after it.

## Where this sits in the larger plan

`docs/plans/2026-08-22-001-feat-social-grievance-intake-plan.md` scopes the
full social pipeline (S1–S8). This unit is **S1**, the visible half of **S5**,
and the human-send half of **S6** — and nothing else. A mention does not
become a `service_request` unless an admin promotes it by hand, and that
promotion route is not built here.

It also settles one of that plan's open questions ("does a public
acknowledgement get posted at all in the demo, or does the reply stop at
drafted and approved?"). **It posts.** A human writes it and a human sends
it.

## Invariants

- **4 — no servicing action on an unauthenticated channel.** A tweet opens
  nothing and mutates nothing. The author handle is stored as text and is
  never resolved to a `customer_id` in this unit. Replying to a tweet is not
  a servicing action: it publishes text, it moves no money and changes no
  account.
- **5 — the agent never publishes.** Unchanged, and this unit is where it
  gets tested. Every outbound post originates in a text box a human typed
  into and a button a human confirmed. There is no auto-reply, no
  draft-then-auto-send, and **no configuration flag that creates one** — the
  publish function is only ever reachable from a route that resolves a CSR
  identity from the session first. When drafting lands later, it produces
  editable text and nothing else.
- **6 — one app.** Fetching and publishing both run inside the Next.js app as
  route handlers. No second service, no worker.
- **7 — no scheduler in the demo path.** The admin presses **Fetch tweets**.
  Nothing runs on a timer.

## Source: an interface with two implementations

```ts
// lib/social/tweet-source.ts
interface TweetSource {
  fetchMentions(opts: { sinceId?: string; limit: number }): Promise<RawTweet[]>
  reply(opts: { inReplyToTweetId: string; text: string }): Promise<PublishedReply>
}
```

`RawTweet` is `{ tweetId, authorHandle, authorName, text, postedAt, permalink,
replyCount, likeCount }` — normalised, so nothing downstream knows which
implementation produced it. `PublishedReply` is
`{ replyTweetId, permalink, sentAt }`.

- **`FixtureTweetSource` (default).** Reads
  `lib/social/fixtures/brand-mentions.json`, deterministic ordering across
  runs. Its `reply()` records the reply locally and returns a synthetic id —
  the full flow works, nothing leaves the machine. The corpus must contain,
  at minimum: a plain grievance, a repeat post from the same author, an aged
  grievance, an account-closure threat, a regulator threat, and **two
  non-grievances** (praise, and an unrelated brand mention) so the urgency
  rules have negative cases to get wrong.
- **`LiveTweetSource` (opt-in, `TWEET_SOURCE=live`).** Browser-session
  automation (the XActions approach), not the X API — API access is priced
  past a prototype, and the write tier especially so. It needs **both**
  session cookies: `X_AUTH_TOKEN` (`auth_token`) and `X_CSRF_TOKEN` (`ct0`,
  which is also the `x-csrf-token` header). Search is login-gated — the
  unauthenticated path reaches profiles and timelines only, and the brand's
  own timeline is the brand talking, not customers complaining.

  **XActions is ported, not installed.** `xactions@3.5.0` declares 35 direct
  dependencies including Prisma, Express, Puppeteer, `node-cron`, `bull`,
  `redis` and Stripe — a second ORM, a second HTTP server and a scheduler,
  which invariants 6 and 7 rule out. Two of its functions are ported to
  TypeScript under `lib/social/vendor/xactions/`, Apache-2.0 attribution
  intact. Note that upstream's `replyToTweet` wraps `postTweet`, so the
  CreateTweet mutation is necessarily present — but the ported module exports
  exactly one write function and it always sets `in_reply_to_tweet_id`. There
  is no exported path that posts a standalone tweet, quotes, deletes or
  schedules one.

Selection is one env var read in one factory. If `live` is set and the
credential is missing, the factory **fails loudly at the call site** — it
must never silently fall back to fixtures. A demo quietly showing canned
tweets while claiming to be live is worse than one that errors.

**Handles in the committed fixture corpus are anonymised.** No real
individual's grievance ships in the repo, per the plan's risk note.
`X_AUTH_TOKEN` is a session credential for a real account — it lives in
`.env.local`, never in the repo, and the account used for the demo should be
a throwaway brand account, not anyone's personal one.

## Schema (migration `0005_*`)

A raw mention is **not** a case, so it does not go in `social_posts` — that
table's `service_request_id` is `notNull` by design and exists to record
posts attached to a case that already exists.

New table `tweet_mentions`:

| column | notes |
|---|---|
| `id` | internal id |
| `tweet_id` | the platform's id — **unique**; this is what makes refetching idempotent |
| `author_handle`, `author_name` | display only; never authentication |
| `text` | the tweet body |
| `posted_at` | the tweet's own timestamp, not ingest time |
| `permalink` | opens the real post in a new tab |
| `reply_count`, `like_count` | reach signals; feed the urgency score |
| `fetched_at` | when we pulled it |
| `is_grievance` | boolean, set by the gate below |
| `urgency` | `critical \| high \| normal` |
| `urgency_reasons` | JSON array of strings — *why*, for display |
| `service_request_id` | **nullable** FK, null until an admin promotes it |
| `dismissed_at` | nullable; an admin can clear noise from the feed |

New table `tweet_replies` — one row per outbound attempt, never overwritten:

| column | notes |
|---|---|
| `id` | internal id |
| `tweet_mention_id` | FK, cascade |
| `text` | exactly what was sent |
| `sent_by_csr_name` | resolved server-side from the session, never from the body |
| `status` | `pending \| sent \| failed` |
| `platform_reply_id`, `platform_permalink` | null until `sent` |
| `error` | the platform's message, on `failed` |
| `is_dry_run` | whether this reached a real timeline; the UI labels it |
| `created_at`, `sent_at` | |

A `failed` row stays. An admin needs to see that a send was attempted and did
not land — silently discarding the attempt is how a customer ends up
believing they were answered when they were not.

`tweet_id UNIQUE` is the whole dedupe story for this unit: fetching twice
over the same window inserts nothing the second time. Author-plus-issue
dedupe into cases is `S3` and is not here.

## The grievance gate and urgency, deterministic for now

No model call in this unit. Both decisions are rule-based in
`lib/social/urgency.ts`, and every rule that fires contributes a
human-readable string to `urgency_reasons`.

- **Gate** — is this a complaint at all? Negative-sentiment and problem
  markers against praise/marketing markers. Cheap, and wrong sometimes; a
  false negative still appears in the feed, just without an urgency badge, so
  a miss costs visibility rather than losing the tweet.
- **`critical`** — stated account closure, threat to contact a regulator or
  the press, fraud or unauthorised-transaction language, or money the
  customer says is missing.
- **`high`** — a grievance that is aged (posted more than the configured
  threshold ago and still unreplied), a repeat post from a handle already in
  the feed, or one with reach above a threshold.
- **`normal`** — everything else, including every non-grievance.

Rules never *lower* a tweet below what an earlier rule set it to, mirroring
R4's one-way severity rule in the plan.

`lib/social/urgency.ts` is the **single swap point** — the same role
`buildCaseThread()` played in `08`. When a classifier exists it replaces the
body of `scoreTweet()`, and nothing above or below changes. The rule version
stays as the fallback when the model call fails, so the feed is never blank
because an API was down.

## Replying: what the console will and will not send

The reply is a public post under the brand's name, so two constraints hold
regardless of what the admin types.

- **No account specifics in public.** `lib/social/reply-guard.ts` rejects a
  reply containing card-number-like digit runs, amounts, balances, or
  transaction identifiers. The intended shape is acknowledge plus handoff to
  a secure channel. This is a **block, not a warning** — an admin who wants
  to discuss specifics moves to DM or the case thread. The rejection names
  the matched pattern so it is fixable rather than mysterious.
- **Length is enforced client- and server-side** against the platform limit,
  with the counter visible while typing. A reply truncated by the platform
  mid-sentence is a worse look than a reply that was never sent.

Sending is **explicitly confirmed**: the composer shows a confirm step
naming the handle being replied to and rendering the exact text, because the
action is public and cannot be taken back from inside this app. Dismissing a
tweet needs no confirmation; posting to X does.

**Dry run is the default.** `TWEET_PUBLISH=live` is a separate env var from
`TWEET_SOURCE` — reading tweets live and posting for real are different
levels of risk and must be switched on separately. With publishing off, the
whole flow runs and writes a `sent` row with a synthetic id, and the UI says
plainly that it was a dry run. Nobody discovers the difference by seeing
their test text appear on a real timeline.

## API

- **`POST /api/social/tweets/fetch`** — CSR-only (`requireCsrName()`). Runs
  the source, upserts on `tweet_id`, scores each new row, returns
  `{ fetched, inserted, skipped }`. Idempotent: a second run inserts zero.
- **`GET /api/social/tweets`** — the feed, with each mention's replies.
  Filters: `urgency`, `grievanceOnly`, `includeDismissed`, `unrepliedOnly`.
  Ordered urgency-first, then `posted_at` descending.
- **`POST /api/social/tweets/[tweetId]/reply`** — CSR-only. Validates through
  `reply-guard`, writes a `pending` row, publishes, then marks `sent` with
  the platform id or `failed` with the error. The `pending` row is written
  **before** the publish call, so a crash mid-send leaves evidence rather
  than a gap. A second POST while a `pending` row exists for the same mention
  is rejected — a double-click must not double-post.
- **`PATCH /api/social/tweets/[tweetId]`** — `{ dismissed: true }`.
  Reversible; the row is never deleted.

Author identity on a reply is always resolved server-side via
`requireCsrName()`, never taken from the request body — the same rule
`08-persisted-messages.md` established for chat messages.

Every fetch and every send writes an `agent_actions` row (R17). The audit
trail must be able to answer "who posted this publicly, and when."

This required a schema change the first draft of this spec missed:
`agent_actions` carried nullable foreign keys to `service_request` and
`chat_messages` only, and a tweet reply belongs to neither — those rows would
have been orphaned and unqueryable. Migration `0005` adds a third nullable
subject, `agent_actions.tweet_mention_id`.

Promotion of a mention into a `service_request` is **out of this unit** — the
column exists for it, the route does not.

## UI

- **`app/admin/(console)/reports/agent/twitter/page.tsx`** — "Twitter Agents",
  nested in the rail as **Reports → Agent → Twitter Agents** rather than flat
  alongside `reports/dashboard` and `reports/grievances`. (This spec first said
  `reports/mentions`; the nesting was the user's explicit direction, and it
  reuses the `AdminNavGroup level={1}` / `AdminNavLink level={2}` pattern that
  Conversations → Channels already uses.) Server component,
  `export const dynamic = "force-dynamic"` (same reason as
  `reports/grievances/page.tsx` — a static prerender would freeze the read).
- **Time windows.** The feed filters by 6h / 12h / 24h on `posted_at`,
  alongside the urgency/grievance/dismissed/unreplied filters, as
  `?window=` search params so filtering stays server-side.
- **`components/admin/mention-feed.tsx`** / **`mention-row.tsx`** /
  **`mention-filters.tsx`** — a row is
  the tweet text, `@handle`, a relative timestamp (`formatDuration` already
  exists), the urgency badge, the reasons that produced it, a permalink, a
  reply control, and a dismiss control. Reasons are shown, not just the
  score: an admin who cannot see *why* a tweet is marked critical stops
  trusting the mark.
- **`components/admin/tweet-reply-composer.tsx`** — reuses the interaction
  contract `08` set for `reply-composer.tsx`: `onSend` returns
  `Promise<boolean>`, the draft clears only on a confirmed write, a failure
  shows inline and keeps the text. Adds the confirm step and the character
  counter. A sent reply renders under its tweet with the CSR's name, the
  time, and a link to the posted reply — or, on failure, the error and a
  retry.
- **A "Needs a reply now" count** at the top — critical + high, undismissed,
  unreplied. Derived by query at render, never a stored counter (R24).
- **`components/admin/fetch-tweets-button.tsx`** — POSTs, then
  `router.refresh()`, and reports what came back ("12 fetched, 3 new"). It
  disables while in flight and surfaces the real error text on failure —
  when a live session cookie has expired, that is the message the operator
  needs to see, not a generic toast.
- A persistent badge shows whether publishing is **live** or **dry run**. It
  is on screen whenever the composer is, not buried in settings.
- Badge colours reuse the tokens `case-clocks.tsx` and
  `customer-status-badge.tsx` already use. No new colour values —
  `context/ui-context.md` governs.

The empty state matters: before the first fetch this page is blank, and it
should say so and point at the button rather than render an unexplained void.

## Deferred

Named here so a reader knows they were considered, not overlooked.

- **ML/LLM grievance understanding** — intent and issue classification,
  sentiment scoring, learned severity. `scoreTweet()` is the seam it plugs
  into. This is the "later, if we get the time" work.
- **AI-drafted replies.** The composer is human-typed here. A drafter fills
  the same box with editable text later; it never gains a send.
- **Promoting a mention into a `service_request`**, and with it dedupe by
  author-plus-issue (`S3`), the customer soft-link, and the case bridge
  (`S4`).
- **A scheduler** (`S7`). The button is the trigger, per invariant 7.
- **DMs, threads, and quote-tweets.** A mention is one post here and a reply
  is one post back; conversation trees are their own problem.

## Check When Done

- pressing **Fetch tweets** twice in a row inserts zero rows the second time,
  and the feed does not change
- the fixture corpus's two non-grievances appear with no urgency badge, and
  the account-closure and regulator tweets are both `critical` with their
  reasons visible on the row
- a reply typed in the console appears under its tweet with the CSR's name
  and a link to the posted reply, and survives a hard refresh
- with `TWEET_PUBLISH=live` unset, a send completes end-to-end, is labelled a
  dry run in the UI, and posts nothing
- a reply containing a card-number-like digit run is blocked before any
  publish call, with the reason shown
- a double-click on send produces exactly one `sent` row and one public reply
- a failed publish leaves a `failed` row with its error, keeps the drafted
  text, and offers a retry
- `TWEET_SOURCE=live` with no `X_AUTH_TOKEN` returns a visible error and
  fetches nothing — it does not fall back to fixtures
- a dismissed tweet leaves the default feed and returns under
  `includeDismissed`
- no code path publishes without a CSR session and an explicit confirm — grep
  the publish function's call sites and confirm each one is reached from a
  human action
- a `customer`-role session cannot reach `/admin/reports/mentions` or any
  `/api/social/tweets*` route
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
