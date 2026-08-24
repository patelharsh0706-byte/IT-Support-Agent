# SQLite Schema and Data Layer

## Goal

Repack the existing mock data (`it-agent/lib/mock/*.ts`) into a real SQLite schema via Drizzle, so the seed data is a drop-in replacement for the fixtures already driving the UI. No new fields beyond what the mock types already carry.

Stack: SQLite via Turso (libSQL) + Drizzle ORM, per `context/architecture.md`. All of this lives in `it-agent/lib/db/`.

## Files

- `it-agent/lib/db/schema.ts` — table definitions
- `it-agent/lib/db/client.ts` — Drizzle client, connects via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- `it-agent/lib/db/seed.ts` — seed script, ports `it-agent/lib/mock/fixtures.ts` into rows
- `it-agent/drizzle.config.ts`

## Tables

Map each mock type to a table 1:1. Keep the union-typed fields (`status`, `priority`, `intent`, etc.) as SQLite `text` columns with the same string values already used in `lib/mock/types.ts` — do not invent new enum values.

### `customers`

Not in the mock types yet (tickets/cases only reference customer name inline) but required so `service_request` and `chat_sessions` have something to belong to.

- `id` (pk)
- `clerk_user_id` — nullable until Clerk linking lands (see `context/architecture.md`, Auth and Access Model)
- `name`
- `email`
- `status` — `active` | `closed` | `unknown`, mirrors `CustomerStatus` in `types.ts`
- `created_at`

### `cards`

Referenced only as free text today (`"...4821"`, `"...0093"` in fixtures). Pull those into real rows.

- `id` (pk)
- `customer_id` (fk → `customers`)
- `last_four`
- `status` — `active` | `frozen` | `inactive`
- `created_at`

### `service_request`

Repacks `Ticket` (`types.ts`) plus the social-case fields from `GrievanceCase`, since both are the same underlying entity (a servicing request), just at different intake channels — per `context/architecture.md`'s storage model note that channel/severity/escalation fields live on `service_request` itself.

- `id` (pk)
- `customer_id` (fk → `customers`, nullable — null until a social case's soft link is claimed)
- `channel` — `amex_support` | `social` | `website_chatbot`, from `CaseChannel`
- `intent` — `card_unblock_activation` | `unrecognized_transaction` | `update_contact_info`, from `Intent`
- `title` — from `Ticket.title` / `GrievanceCase.summary`
- `priority` — `low` | `medium` | `high`, from `Priority`
- `status` — `open` | `in_progress` | `resolved` | `escalated`, from `TicketStatus`
- `current_severity` — `low` | `medium` | `high`, from `GrievanceCase.currentSeverity` (mutable, distinct from `priority`)
- `customer_verified` — bool, from `GrievanceCase.customerVerified`
- `escalated_at` — nullable, set once
- `contacted_by_csr_name` — nullable
- `reply_state` — `needs_reply` | `draft_ready` | `replied` | `escalated`, from `ReplyState`
- `original_post_url` — nullable
- `classification_intent` / `classification_confidence` — nullable, from `GrievanceCase.classification`
- `ai_draft_reply` — nullable
- `created_at`
- `updated_at`

### `social_posts`

Repacks `DedupePost`.

- `id` (pk)
- `service_request_id` (fk → `service_request`)
- `permalink`
- `excerpt`
- `posted_at`

### `severity_changes`

Repacks `SeverityChange`.

- `id` (pk)
- `service_request_id` (fk → `service_request`)
- `from_severity` — nullable
- `to_severity`
- `changed_at`
- `reason` — nullable

### `agent_actions`

Repacks `ActivityEvent`, shared by both `chat_messages.activity_events` and `GrievanceCase.toolCallLog`.

- `id` (pk)
- `service_request_id` (fk → `service_request`, nullable — some events attach to a chat message instead)
- `chat_message_id` (fk → `chat_messages`, nullable)
- `stage`
- `status` — `running` | `ok` | `failed` | `denied`, from `ActivityStatus`
- `detail` — nullable
- `timestamp`

### `chat_sessions`

Not explicit in the mock types (chat messages currently key off `ticketId` directly), but required by `context/architecture.md`'s table list. One session per ticket thread for now.

- `id` (pk)
- `customer_id` (fk → `customers`)
- `service_request_id` (fk → `service_request`)
- `created_at`

### `chat_messages`

Repacks `ChatMessage`.

- `id` (pk)
- `chat_session_id` (fk → `chat_sessions`)
- `author_role` — `customer` | `agent`, from `MessageAuthorRole`
- `author_name`
- `content`
- `timestamp`

Activity events for a message are rows in `agent_actions` with `chat_message_id` set, not a JSON column — keeps them queryable and matches how `GrievanceCase.toolCallLog` is already a flat list rather than JSON.

## Dashboard metrics

`DashboardMetrics` (`types.ts`) is **not** a table. Per `context/architecture.md`'s storage model, every figure on the dashboard is a query over `service_request` / `social_posts` / `severity_changes` at read time — never a stored, cacheable counter. Write these as query functions in `it-agent/lib/db/queries.ts`, not as seed rows:

- `openBySeverity` — `GROUP BY current_severity WHERE status != 'resolved'`
- `oldestUnansweredCaseId` / `oldestUnansweredAgeHours` — oldest `service_request` where `reply_state = 'needs_reply'`
- `escalationsPastThreshold` — count where `escalated_at` is set and past the threshold
- `closedAccountOpenGrievanceCount` — join to `customers` where `customers.status = 'closed'` and the linked `service_request` was still open at closure

## Seed data

Port `it-agent/lib/mock/fixtures.ts` row-for-row:

- `tickets` → `service_request` rows with `channel = 'amex_support'` (chat-originated) and no `current_severity` set beyond `priority`
- `chatMessages` → `chat_sessions` (one per distinct `ticketId`) + `chat_messages`, with each message's `activityEvents` becoming `agent_actions` rows
- `grievanceCases` → `service_request` rows (`channel` per case), plus `dedupePosts` → `social_posts`, `severityHistory` → `severity_changes`, `toolCallLog` → `agent_actions`
- Include at least one `customers` row with `status = 'closed'` and a still-open linked `service_request`, so `closedAccountOpenGrievanceCount` has real data to report (see `context/project-overview.md`, Success Criteria 5)
- Card numbers (`...4821`, `...0093`) become real `cards` rows linked to their customer

## Check When Done

- `schema.ts` defines all tables above with correct fk relations
- Seed script populates every table from the fixture data and is safe to re-run
- `lib/db/queries.ts` computes all four dashboard metrics from live rows, not stored counters
- `npm run build` passes
