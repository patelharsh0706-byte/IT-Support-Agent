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
  `escalation_reason` recorded, a `severity_changes` row written, and the
  reason inserted into the thread as a customer message so the CSR sees
  *why* in the conversation, not just a timestamp.

Message authorship is always resolved server-side (`requireCsrName()` /
the resolved customer), never taken from the request body.

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
  escalation POSTs, replaces the ticket from the returned row, re-reads
  the thread (the escalation wrote into it), and refreshes. Threads load
  per ticket on selection rather than in an effect — no cascading render,
  and no fetch for a thread never opened. The first ticket's thread is
  server-rendered in `app/customer/dashboard/page.tsx` (private notes
  filtered there too), so the initial view needs no fetch.

## Check When Done

- a CSR reply and a private note both survive a hard refresh
- a private note never appears in a customer's `GET /messages` response
- a customer escalation persists status/severity/reason and lands the
  reason in the shared thread
- a failed send keeps the drafted text
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
