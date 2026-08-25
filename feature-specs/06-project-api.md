The database schema is ready (`lib/sqlite/schema.ts`, per `05-sqlite.md`). Build the backend service-request API routes only.

This spec was originally pasted as a generic "Project" CRUD example (list/create/rename/delete, `ownerId`). There is no `projects` table in this app — the entity that maps onto it is `service_request`, the table backing both customer-facing tickets and CSR-facing grievance cases (`context/architecture.md`, Storage Model). Reframed below onto the real schema.

## Routes

Create REST endpoints for:

- `GET /api/service-requests` — list the current customer's service requests
- `POST /api/service-requests` — create a service request (a customer-initiated ticket)
- `PATCH /api/service-requests/[serviceRequestId]` — rename a service request (update `title`)
- `DELETE /api/service-requests/[serviceRequestId]` — delete a service request

## Rules

Use the authenticated Clerk user's linked `customers.id` as `ownerId` (`service_request.customer_id`) — never `service_request.id` and never a value from the request body. `lib/auth/session.ts`'s `requireCustomer()` only resolves the Clerk user id and role today; resolving the internal `customer_id` from `customers.clerk_user_id` is new work this unit adds (see `context/progress-tracker.md`, Next Up — this was already the documented blocker for U3). Since no seeded customer has `clerk_user_id` set yet, resolve-or-create on first request: look up `customers` by `clerk_user_id`, and if none exists, insert one from the Clerk profile (`currentUser()`'s email/name) rather than failing closed for every real sign-in.

When creating:

- default missing `title` to `Untitled Ticket`
- `channel` is always `amex_support` (this route is the customer's own ticket surface, not chat intake or social intake)
- `intent` defaults to `null` — routes do not classify; that is `lib/agent/classify.ts`'s job, not built yet
- `priority` defaults to `medium`, `status` defaults to `open`, `current_severity` defaults to `low`, `customer_verified` defaults to `true` (an authenticated customer creating their own ticket is verified by definition), `reply_state` defaults to `needs_reply`
- id: `tkt_` + `crypto.randomUUID()`, matching the existing `tkt_*` / `case_*` / `cust_*` prefix convention in `lib/sqlite/seed.ts` — no sequential IDs

Security:

- unauthenticated requests return `401`
- only the request's owning customer can rename or delete it
- a missing id returns `404`; an id that exists but belongs to another customer returns `403` — existence is checked before ownership, so the two cases are distinguishable (this does not hide whether an id exists, only who owns it)

Keep this backend-only. Do not wire the UI yet.

## Check When Done

- routes exist for list/create/rename/delete under `/api/service-requests`
- owner checks are enforced for rename/delete
- `401`, `403`, and `404` responses are handled correctly
- `npm run build` passes
