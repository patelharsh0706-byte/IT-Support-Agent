# 08 — Persisted messages and real escalation

Makes the two things `07-wire-ui-api` deliberately left as local React
state real: a CSR reply/private note, and a customer escalation. Both now
round-trip through SQLite, so a hard refresh renders the same thread.

This is the unit `07` named as future work ("persisting CSR messages needs
a new table and touches Invariant 5 carefully; it's a separate future
unit"). No new table was needed in the end — `chat_messages` already
existed from `05-sqlite`; it needed two columns.

## Invariant 5 (the agent never publishes)

Upheld, and unchanged in character. Every write added here is initiated by
a human clicking Send / Add note / Escalate. There is no auto-send path,
no scheduled send, and no flag that creates one. `chat_messages.author_role`
gains `"csr"` alongside the pre-existing `"agent"` precisely so a human
reply stays distinguishable from an eventual bot-authored one in the audit
trail — the AI pipeline (`lib/agent/`, not built) can only ever draft.

## Schema (migration `0003_fixed_jackpot`)

- `chat_messages.is_private_note` (boolean, default false) — CSR-only text.
- `chat_messages.author_role` widened to `customer | agent | csr`.
- `service_request.escalation_reason` (text) — the customer's own words.
  Distinct from `severity_changes.reason`, which is generic to any
  severity change.

## API

- `POST /api/service-requests/[id]/messages` — customer or CSR sends one
  message. A customer can only write to their own case; a CSR can write to
  any. `isPrivateNote` is honored **only** for a CSR sender — never trusted
  from a customer. A non-private CSR send also marks the case replied and
  stamps `contacted_by_csr_name`, mirroring the side effect the local-only
  UI used to fake.
- `GET /api/service-requests/[id]/messages` — the thread. Private notes are
  stripped server-side for a customer session, beyond the customer UI
  simply not rendering them.
- `POST /api/service-requests/[id]/escalate` — one transaction: status →
  `escalated`, priority/severity → `high`, `escalated_at` stamped,
  `escalation_reason` recorded, and a `severity_changes` row written.

Message authorship is always resolved server-side (`requireCsrName()` /
the resolved customer), never taken from the request body.

## An escalation is an event, not a message

The first cut of the escalate route copied the customer's reason into
`chat_messages` as a customer-authored row, so the CSR would see *why*
in the thread. In the console that rendered as an ordinary reply —
indistinguishable from the customer simply saying "it happened yesterday
night", with the escalation itself invisible. Corrected:

- `escalateServiceRequest()` writes no chat message. `escalated_at` +
  `escalation_reason` on the `service_request` row are the single source
  of truth, so the two can't drift.
- `CaseThreadMessage` gains `kind: "message" | "escalation"`.
  `buildCaseThread()` synthesizes the escalation entry at its
  `escalated_at` position — the same merge treatment `dedupePosts`
  already gets.
- **The marker is gated on the stated reason, not on `escalatedAt`.**
  The two fields mean different things: `escalatedAt` is the
  time-in-escalation clock basis, set by any path that puts a case into
  escalation (seeding, intake, a severity bump), while
  `escalation_reason` is written only when a customer actually escalated
  and said why. Gating on the timestamp invented an escalation event for
  cases where none happened and attributed it to a customer who never
  escalated — visible on three seeded cases as "Escalated by {name} — No
  reason given", two of which were not even in `escalated` status. Those
  cases keep their escalation clock and queue behaviour; they just carry
  no thread event. A marker therefore always has a reason to show.
- Both surfaces render the event through one shared
  `components/shared/escalation-marker.tsx` — a centered marker with
  "Reason: …" beneath — so the CSR console and the customer dashboard
  cannot drift apart on what an escalation looks like. Only the title
  differs: the console names the customer ("Escalated by {name}"), the
  customer's own dashboard says "You escalated this ticket".
- `casePreviewText()` labels it (`Escalated — {reason}`) so the
  conversation list never quotes the reason as if it were just said.
- Customer side: `lib/mock/ticket-thread.ts` (new) is the counterpart to
  `case-thread.ts` — `buildTicketThread(ticket, messages)` merges the
  ticket's chat messages with its escalation event in timestamp order, so
  the event lands in its real chronological position rather than being
  pinned to the end. `MessageList` now takes those entries instead of a
  bare `ChatMessage[]`.
- Migration `0004_drop_escalation_chat_messages` deletes rows the old
  behavior already wrote, matched on case + author + content + exact
  escalation timestamp so a genuine message that merely repeats the
  reason text survives.

`ticket-status-panel.tsx` already presented the escalation with its
reason as case status, and that disagreement between panel and thread is
what surfaced the bug. It stays as-is: the panel is the ticket's current
state, the thread marker is the event in sequence.

## UI

- **`lib/mock/case-thread.ts`** — `buildCaseThread()` was the documented
  "single swap point for real message data." It now merges social-origin
  `dedupePosts` with the case's persisted `realChatMessages` in timestamp
  order, and only synthesizes a seed message when both are empty. An
  `"agent"`-authored row renders outbound like a CSR — from the customer's
  side of the glass both read as "someone from Amex replied"; the row
  keeps the finer distinction. `casePreviewText()` now skips private notes
  — the conversation list should preview the conversation, not the team's
  internal commentary on it.
- **`components/admin/conversation-pane.tsx`** — `handleSend` /
  `handleAddPrivateNote` POST and append the row the server actually
  wrote (server id and timestamp, not client-invented ones), then
  `router.refresh()` so the list preview, queue table, and nav counts stop
  disagreeing with the open thread. The `currentCsrName` prop is gone: the
  name now comes back from the write.
- **`components/admin/reply-composer.tsx`**, **`components/editor/composer.tsx`**
  — `onSend` returns `Promise<boolean>`; drafts clear only on a confirmed
  write, so a failed send never loses text. Both show an inline error and
  disable while in flight.
- **`components/customer/customer-dashboard.tsx`** — the composer POSTs;
  escalation POSTs, replaces the ticket from the row the route returned,
  and refreshes. It writes no message: the escalation reaches the thread
  through `buildTicketThread()`, derived from the updated ticket row.
  Threads load per ticket on selection rather than in an effect — no cascading render,
  and no fetch for a thread never opened. The first ticket's thread is
  server-rendered in `app/customer/dashboard/page.tsx` (private notes
  filtered there too), so the initial view needs no fetch.

## Check When Done

- a CSR reply and a private note both survive a hard refresh
- a private note never appears in a customer's `GET /messages` response
- a customer escalation persists status/severity/reason and shows as an
  escalation marker — never as a chat message — in *both* the CSR thread
  and the customer's own thread, in its real chronological position
- a failed send keeps the drafted text
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
