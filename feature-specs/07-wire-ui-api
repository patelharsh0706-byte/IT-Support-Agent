Wire the customer dashboard and the CSR admin console to real SQLite data.

This was originally pasted as a generic "wire the editor home sidebar and dialogs to the real project API" template (Liveblocks room IDs, owned/shared projects, multi-workspace navigation). None of that exists in this app. Reframed below onto the real entity — `service_request` — and onto both real UI surfaces, per the user's explicit direction to cover the customer dashboard and the admin console together.

## Scope decisions

- **Customer side: list + create only.** Rename/delete were dropped — they were artifacts of the generic template (a document/project list), not real support-ticket UX. A customer editing or deleting their own case's title/audit trail doesn't fit a servicing-and-compliance demo. The backend routes (`PATCH`/`DELETE` on `/api/service-requests/[id]`, from `06-project-api.md`) stay built and tested, just not customer-facing.
- **Admin side: read-only.** The conversation list, case detail, and queue table become real. Sending a reply/private note stays local-state only, same as before wiring — persisting CSR messages needs a new table and touches Invariant 5 carefully; it's a separate future unit, not a side effect of this one.
- **Dashboard metrics: 3 of 4 real, 1 explicitly flagged.** `closedAccountOpenGrievanceCount` cannot be derived from the current schema (no closure timestamp or status history on `customers`) — this was already an open question from a prior review. The dashboard renders it as "Not yet available," never a fake number.

## Customer dashboard

`app/customer/dashboard/page.tsx` is now an async server component: `requireCustomer()` → `resolveCustomer()` → `listServiceRequestsForCustomer()` (all pre-existing from `06-project-api.md`), mapped to `Ticket[]` via `lib/mock/from-service-request.ts`'s `toTicket()`, passed into `components/customer/customer-dashboard.tsx` (the moved client component holding all interactive state).

`Ticket.intent` widened to `Intent | null` — a customer-created ticket has no intent until the (not yet built) agent pipeline classifies it.

`hooks/useServiceRequestActions.ts` — create-only: `POST /api/service-requests`, maps the response via `toTicket()`, prepends to the local list, selects it.

Chat messages, escalation, and the agent pipeline stay exactly as before (mock/local-state) — out of scope here.

## Admin console

New reads in `lib/sqlite/queries.ts` (React `cache()`-wrapped where read more than once per request):

- `listGrievanceCases()` — every `service_request` row across all channels (the mock model's `Ticket`/`GrievanceCase` split doesn't exist in the real schema — both live in one table), assembled with its `customers` join, `social_posts`, `severity_changes`, and `agent_actions` into the existing `GrievanceCase` shape. No `relations()` are declared on the schema, so this fetches each table separately and assembles in JS — fine at this data volume, not a pattern to scale past a prototype.
- `getGrievanceCaseDetail(id)` — one case from the same list.
- `computeDashboardMetrics()` — `openBySeverity` and `oldestUnanswered*` computed live; `escalationsPastThreshold` uses a documented 24-hour "escalated and still unresolved" placeholder (no threshold was defined anywhere in the codebase); `closedAccountOpenGrievanceCount` returns `null` (not computable, see Scope decisions above).
- `severityChangedRecently` (on `listGrievanceCases()`'s output) uses a documented 24-hour "changed recently" placeholder for the same reason.

CSR identity: `lib/mock/current-csr.ts`'s hardcoded `currentCsrName` constant is retired. `lib/auth/session.ts`'s new `requireCsrName()` resolves the real signed-in CSR's name from the Clerk profile (no new DB table — `contactedByCsrName` was already a free-text column, not a foreign key). `lib/admin/conversation-views.ts`'s `matchesAssignment()`/`filterCases()`/`countByAssignment()` now take `currentCsrName` as a parameter instead of importing the mock constant.

Wired routes: `app/admin/(console)/layout.tsx` (nav-rail counts), `app/admin/(console)/conversations/layout.tsx` (list pane), `app/admin/(console)/conversations/[id]/page.tsx` (case detail), `app/admin/(console)/reports/grievances/page.tsx` (queue table), `app/admin/(console)/reports/dashboard/page.tsx` (metrics). The reports pages carry `export const dynamic = "force-dynamic"` — neither calls a Next.js dynamic API on its own, so without this Next would statically prerender them at build time and freeze the DB read, which is wrong for pages whose own design intent is "always a live query."

## Check When Done

- customer sidebar/create round-trip through real SQLite (persists across a hard refresh)
- a signed-in customer never sees another customer's tickets
- admin conversation list, case detail, and queue table all show real seeded data, not fixtures
- the "Mine" filter matches the real signed-in CSR's name, not a hardcoded one
- 3 dashboard tiles show real computed numbers; the 4th visibly says it's not yet available
- `npm run build` passes
