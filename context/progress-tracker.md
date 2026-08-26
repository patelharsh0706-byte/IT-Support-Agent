# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- Repackaged from the original IT-helpdesk framing to the **Amex Intelligent
  Customer Service Automation Loop** (Card Servicing, Transaction & Dispute
  Servicing, Account & Profile Servicing). `context/project-overview.md`,
  `context/architecture.md`, and `feature-specs/03-auth.md` are rewritten for
  the new framing; `docs/plans/2026-08-14-001-…` (backend spine) and
  `docs/plans/2026-08-22-001-…` (social grievance intake) are the two active
  plans. The data layer (U1–U2) now exists — see Completed below. Next is
  the agent pipeline itself: `lib/agent/classify.ts`, `lib/agent/pipeline.ts`,
  and `app/api/chat/route.ts`, wired to the schema just seeded.

## Completed

- **01-design-system** — shadcn/ui + UI primitives
  - shadcn/ui initialised in `it-agent/` (`components.json`, style
    `radix-nova`, CSS variables, Lucide icon library)
  - Components added via the CLI, unmodified: `button`, `card`, `dialog`,
    `input`, `textarea`, `tabs`, `scroll-area` in `components/ui/`
  - `lucide-react` installed (pulled in by the shadcn preset)
  - `lib/utils.ts` created with the reusable `cn()` helper
    (`clsx` + `tailwind-merge`)
  - `app/globals.css` rewritten to declare the `ui-context.md` tokens and
    map every shadcn semantic variable onto them
  - `app/layout.tsx` now exposes Geist as `--font-sans` / `--font-mono`
    (was `--font-geist-*`) to match `ui-context.md`, and carries real app
    metadata
  - Verified: a temporary route importing all seven components plus `cn()`
    built and prerendered clean, then was removed; `npm run build` passes.
    Compiled CSS contains `color-scheme: light`, zero
    `prefers-color-scheme` blocks, and no stock shadcn palette values —
    every semantic variable resolves to a product token.

- **02-editor** — base editor chrome
  - `components/editor/editor-navbar.tsx` — `EditorNavbar`, a fixed-height
    (`h-14`) top navbar with three equal flex sections. Left holds the
    sidebar toggle (`PanelLeftClose` when open, `PanelLeftOpen` when
    closed, i.e. the icon shows the action); centre and right are present
    but empty, reserved for later units. Dark chrome surface with a
    hairline bottom border.
  - `components/editor/project-sidebar.tsx` — `ProjectSidebar`, an
    `absolute inset-y-0 left-0` overlay that slides in via
    `translate-x-0` / `-translate-x-full`, so it floats over the canvas
    and never pushes content. `Projects` header with a close button,
    shadcn `Tabs` (*My Projects* / *Shared*) both rendering an empty
    placeholder inside a `ScrollArea`, and a full-width `New Project`
    button with `Plus` pinned to the bottom. Width `w-70` (280px), matching
    the left-sidebar width in `ui-context.md`.
  - `components/editor/editor-dialog.tsx` — `EditorDialog`, the shared
    dialog pattern: `open` / `onOpenChange`, `title`, optional
    `description`, optional body, and a footer that pairs a cancel control
    with caller-supplied `actions`. Wraps the vendored shadcn `dialog`
    (unmodified) and styles from tokens only. No concrete dialogs built.
  - New chrome tokens in `app/globals.css` (`--bg-chrome`,
    `--bg-chrome-foreground`, `--border-chrome`), exposed as
    `bg-chrome` / `text-chrome-foreground` / `border-chrome-border`, and
    documented in `ui-context.md`.
  - Verified: `npx tsc --noEmit` clean, `npm run lint` clean,
    `npm run build` passes. A temporary `app/editor-check/` route mounting
    all three components prerendered clean (navbar, sidebar tabs, empty
    states and `New Project` all present in the emitted HTML) and was then
    removed. Compiled CSS shows every new utility resolving to a token —
    no hardcoded hex in feature code.
  - **Scope note (resolved 2026-08-23):** this unit's project-sidebar (My
    Projects / Shared tabs) did not map onto the Amex framing. It was
    deleted and repurposed as `ticket-sidebar.tsx` — see the
    `04-project-dialogs` entry below.

- **03-auth (Clerk)** — auth layer, replacing the earlier Credentials-provider design
  - **Plan change 2026-08-22:** auth moved from Auth.js (NextAuth) Credentials
    to **Clerk**. The old two-door custom login (`app/login/`,
    `app/admin/login/`, `components/auth/login-form.tsx`) is deleted —
    superseded by Clerk's hosted `<SignIn />` / `<SignUp />`.
  - Clerk CLI installed and linked (`clerk init --app app_3IGbdc5pSUETxiFKOXTmfH8gIzD`):
    `@clerk/nextjs` added, `ClerkProvider` wraps `app/layout.tsx`,
    `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx`
    scaffolded, `.env.local` carries the Clerk keys and route env vars.
  - `@clerk/ui` installed. `ClerkProvider` uses the `dark` base theme from
    `@clerk/ui/themes`, with every `variables` entry overridden to an
    existing app CSS token (`var(--bg-base)`, `var(--accent-primary)`, etc.)
    — no hardcoded colors, per `feature-specs/03-auth.md`.
  - `components/auth/auth-split-layout.tsx` — `AuthSplitLayout`, the shared
    shell for both auth pages: two-panel on large screens (`--bg-chrome`
    left panel with compact logo, tagline, text-only feature list; centred
    Clerk form on `--bg-base` right panel), form-only on small screens
    (left panel is `hidden lg:flex`). No gradients, hero imagery, or feature
    cards. **Supersedes** the old single-column centred-card login pattern
    documented in `ui-context.md` — that doc is updated to match.
  - **Kept the customer/csr role split** rather than dropping it (which the
    generic Clerk spec as pasted didn't mention) — confirmed with the user.
    Role lives in Clerk `publicMetadata.role`, exposed as a
    `sessionClaims.metadata.role` session-token claim — configured on the
    linked Clerk app via `clerk config patch --json
    '{"session":{"claims":{"metadata":"{{user.public_metadata}}"}}}'`.
    Defaults to `customer` on sign-up; `csr` is granted manually (Clerk
    Dashboard or `clerk users`), not self-serve.
  - `proxy.ts` rebuilt on `clerkMiddleware`: `/sign-in` and `/sign-up` stay
    public; every other route requires a signed-in session (redirects to
    sign-in); `/admin/*` additionally requires `role === "csr"`, rewriting
    to `/404` for anyone else rather than redirecting, so the surface isn't
    advertised.
  - `lib/auth/session.ts` — `requireCustomer()` / `requireCSR()`, the only
    session accessors. Currently resolve the Clerk user id and role only;
    resolving an internal `customer_id` is blocked on U2's
    `customers.clerk_user_id` column.
  - `app/page.tsx` (`/`) redirects by role: `csr` → `/admin`, `customer` →
    `/editor`. `/editor` is a new real route (promoted from the temporary
    `app/editor-check/` verification route, which is now deleted) mounting
    the `02-editor` chrome. `EditorNavbar`'s right section — previously
    empty — now holds Clerk's `<UserButton />`.
  - `.env.example` added, documenting the Clerk env vars (no secret values).
  - Verified: `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build`
    passes (`/`, `/editor`, `/sign-in`, `/sign-up` all build; `/admin` has
    no page yet — CSR console is out of this unit's scope).
  - **Still to build (blocked on U2):** `customers.clerk_user_id` /
    `customers.role` columns, so `lib/auth/session.ts` can resolve an
    internal `customer_id` instead of stopping at the Clerk user id; the
    CSR console itself (`app/admin/page.tsx` and beyond) is a separate unit.

- **04-project-dialogs — customer & admin dashboard UI (mock data only)**
  - Scope: visual layer only, per the spec's "No API calls or persistence
    yet." No `app/api/*` routes, no DB — all state is fixture data in
    `lib/mock/fixtures.ts` (typed via `lib/mock/types.ts`) plus local
    React state, so nothing survives a refresh.
  - shadcn primitives added via CLI: `select`, `checkbox`, `avatar`,
    `separator`, `badge`, `skeleton` (the ones flagged missing under
    `01-design-system`).
  - `components/shared/` — `activity-event-row.tsx` and
    `activity-panel.tsx` implement the 4-status activity vocabulary
    (`running`/`ok`/`failed`/`denied`); shared by the customer Agent
    Activity panel and the admin case-detail tool-call log.
    `severity-badge.tsx` / `priority-badge.tsx` reuse the existing 3
    state tokens (no dedicated severity/priority palette exists yet —
    confirmed with the user rather than inventing new tokens).
    `denied` gets a muted icon treatment, not a 4th color, since
    `ui-context.md` only defines 3 status colors.
  - Customer dashboard (`/editor`): `ticket-sidebar.tsx` replaces the
    dormant `project-sidebar.tsx` (same slide-in-overlay mechanics,
    renamed Projects → Tickets); `chat-header.tsx`, `message-list.tsx` /
    `message-item.tsx`, `composer.tsx`, and `agent-activity-panel.tsx`
    (the right-column activity stream) are new. `EditorNavbar`'s
    aria-labels updated from "projects" to "tickets" to match. Ticket
    selection, sending a message, and creating a ticket (via the reused
    `EditorDialog`) are all local `useState`, not persisted.
  - Admin dashboard: new `AdminNavbar` (Queue/Dashboard nav, same dark
    chrome as `EditorNavbar`) plus three routes — `/admin/grievances`
    (queue, priority-band-then-age sorted, mixing `channel: "chat"` and
    `channel: "social"` cases per `project-overview.md`),
    `/admin/grievances/[id]` (case detail: clocks, dedupe history,
    severity history, tool-call log, reply composer), and
    `/admin/grievances/dashboard` (4 metric tiles, headline = customers
    whose account closed while a grievance sat open). `app/admin/page.tsx`
    is a plain `redirect("/admin/grievances")`.
  - Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
    clean. Visually verified via a temporary Playwright script against
    the dev server (chromium-cli wasn't available in this environment) —
    all 4 activity statuses and 3 terminal states, both dashboards, ticket
    creation/selection, and the reply-composer send flow all confirmed
    working. `proxy.ts` was temporarily edited to exempt the routes under
    test (no test auth session was available) and fully reverted before
    finishing — confirmed via `git diff proxy.ts` showing no changes, and
    a final `curl` check confirming `/editor` and `/admin/grievances`
    both still redirect unauthenticated requests to sign-in.
  - **Not done in this unit:** no real severity/priority design tokens
    (open decision, currently reusing the 3 state tokens); no backend —
    all four dashboards' data is fixture-only.
  - **Superseded by the two entries below** — the routes and `AdminNavbar`
    described here (`/editor`, `/admin/grievances` as the CSR landing
    page) were renamed and restructured on 2026-08-23.

- **Route rename — `/customer/*` and `/admin/*` split (2026-08-23)**
  - Fixed a real confusion bug: customer and CSR sign-in shared the same
    generic `AuthSplitLayout` shell with only a small badge/footnote
    telling them apart, and both roles could end up looking at what
    read as "the same dashboard" because CSR accounts had no role
    metadata set yet (see below).
  - `/sign-in` → `/customer/sign-in`; `/editor` → `/customer/dashboard`;
    the CSR landing page changed from `/admin/grievances` to
    `/admin/dashboard` (later relocated again, see the Chatwoot entry).
    `proxy.ts`'s public-route matcher and unauthenticated redirect
    target updated to match; `NEXT_PUBLIC_CLERK_SIGN_IN_URL` updated in
    `.env.local`/`.env.example` (both gitignored by the repo's blanket
    `.env*` rule, so this does not propagate to other checkouts —
    flagged to the user, not yet fixed).
  - Root cause of "both dashboards look the same": neither Clerk test
    account (`patelharsh0706@gmail.com`, `killer.master502@gmail.com`)
    had `publicMetadata.role` set, so `role === "csr"` was never true
    and every sign-in fell through to `/customer/dashboard`. Fixed via
    `clerk api /users/{id}/metadata -X PATCH` (note: PATCH must target
    `/users/{id}/metadata`, not `/users/{id}` with a `public_metadata`
    body — the latter is a deprecated, silently-rejected parameter as
    of Clerk's current Backend API). `patelharsh0706@gmail.com` is now
    `csr`, `killer.master502@gmail.com` is `customer`.
  - `app/admin/page.tsx` — a non-CSR session signing in through
    `/admin/sign-in` previously redirected silently to the customer
    dashboard with no explanation. It's now a role-aware landing page:
    `csr` redirects straight through, anyone else sees a "This isn't a
    CSR account" card with links back to their own dashboard or to
    re-sign-in as CSR. `proxy.ts`'s admin gate was adjusted so `/admin`
    itself (only) is reachable by any signed-in user for this purpose;
    every real admin surface below it stays 404-gated for non-CSR
    sessions, so the console is still never advertised.
  - Verified via minted Clerk session tokens decoded locally (not a
    full browser sign-in — the dev-instance `accounts.dev` ↔ localhost
    handshake defeated headless automation) plus `curl` checks that
    unauthenticated requests to both new sign-in paths still redirect
    correctly.

- **Chatwoot-style CSR console restructure (2026-08-23)**
  - Reorganized the admin dashboard from three disconnected full-page
    routes (queue table, case-detail page, metrics page, each
    re-declaring its own navbar) into a persistent multi-pane console:
    left nav rail, middle conversation list, right conversation pane
    with a pinned reply/private-note composer and a collapsible case
    context sidebar — modeled on a Chatwoot screenshot the user
    supplied. Content is unchanged; this is a chrome reorganization.
  - Route group `app/admin/(console)/layout.tsx` wraps the rail around
    everything except `/admin` (the role-mismatch card) and
    `/admin/sign-in` (Clerk's split layout). New routes:
    `/admin/conversations` (empty state), `/admin/conversations/[id]`
    (the conversation pane), `/admin/reports/dashboard` (the old
    4-metric page, content unchanged), `/admin/reports/grievances` (the
    old queue table, content unchanged, kept per explicit user request
    rather than deleted). `app/admin/page.tsx`'s CSR redirect now points
    at `/admin/conversations`.
  - List/filter logic centralized in `lib/admin/conversation-views.ts`:
    filters are **query params** (`?view=`, `?channel=`, `?assignment=`,
    `?q=`), selection is the `[id]` path segment — deliberately not a
    sibling route per filter, so switching filters never unmounts the
    open conversation (only `useSearchParams()` changes). `Unattended`
    = `replyState === "needs_reply"`; `Participating` =
    `contactedByCsrName !== null`; `Mentions` has no backing data and is
    an intentional empty state; queue sort order (severity band, then
    oldest-first) is now defined once here and reused by both the
    conversation list and the retained queue table.
  - `CaseChannel` widened from `"chat" | "social"` to `"amex_support" |
    "social" | "website_chatbot"` (`lib/mock/channels.ts` is the single
    label/icon source); the 4 fixture cases were re-tagged across all
    three channels and given `customerName`/`customerHandle` fields
    (invented display identities, not real customers). No message
    thread existed on `GrievanceCase` before this — `lib/mock/case-thread.ts`
    builds one from `dedupePosts` (real per-case data) and synthesizes a
    single opening message from `summary` for the two cases that had no
    posts, so a thread is never empty. That function is the documented
    single swap point for real message data later. `currentCsrName`
    (`lib/mock/current-csr.ts`, `"J. Alvarez"`) is the one piece of
    invented data in this unit, needed to make the "Mine" filter
    demonstrable — confined to one file, swaps for the real Clerk
    session identity later.
  - Deleted: `admin-navbar.tsx`, `case-detail.tsx` (decomposed into
    `conversation-pane/header/thread/message/context-sidebar.tsx`).
    Kept and adapted: `grievance-queue.tsx`/`queue-row.tsx` (now read
    channel icons from `lib/mock/channels.ts`, link into
    `/admin/conversations/[id]` instead of the deleted
    `/admin/grievances/[id]`, share a grid-template constant via
    `lib/admin/queue-grid.ts` instead of duplicating it).
    `reply-composer.tsx` extended in place with Reply/Private Note tabs
    (`components/ui/tabs`) rather than replaced — the Private Note tab
    has no send path in any reply state, same no-auto-send guarantee as
    the Reply tab. Added shadcn `collapsible`, `dropdown-menu`,
    `tooltip` via the CLI (all already inside the `radix-ui` umbrella
    dependency, no new npm installs); `TooltipProvider` added to
    `app/layout.tsx` root as the CLI's post-install step requires.
  - Fixed two latent bugs surfaced while building this, both real and
    pre-existing (not new): `text-accent-primary` was used in
    `app/admin/dashboard/page.tsx` and `case-detail.tsx` but no
    `--color-accent-primary` alias exists in `globals.css`'s `@theme
    inline` block, so the class silently did nothing — replaced with
    `text-primary` everywhere it survived. More significantly: Radix's
    `ScrollAreaPrimitive.Viewport` wraps its children in an inline
    `style="min-width:100%;display:table"` div for scroll-size
    measurement; `display:table` sizes to content's max-content width,
    so any `ScrollArea` containing `truncate`/nowrap text (the
    tool-call-log detail lines, badge labels) could silently force
    itself wider than its container and get clipped by an ancestor's
    `overflow-hidden` — invisible to the user, not just cosmetically
    truncated. This was latent in `components/shared/activity-panel.tsx`
    since it was first built, just never triggered because it always
    had enough width before. Fixed once, globally, in `app/globals.css`:
    `[data-slot="scroll-area-viewport"] > div { display: block
    !important; }` (an inline style can only be overridden by
    `!important` in a stylesheet — this could not be fixed at
    individual call sites). Confirmed fixed by walking the DOM ancestor
    chain with `getComputedStyle` in a headless browser, not just by
    re-screenshotting.
  - Verified: `tsc`/`lint`/`build` clean; every conversation view/filter
    combination, both Reports pages, all 4 fixture cases' conversation
    panes (including the two synthesized-thread cases), the private-note
    and reply-send flows, and the context-sidebar toggle all visually
    confirmed via a temporary `proxy.ts` exemption (reverted and
    confirmed via `git diff proxy.ts` returning empty each time) plus a
    zero-console-errors check on every navigation. `/customer/dashboard`
    re-screenshotted and confirmed pixel-identical — nothing under
    `components/editor/` was touched.
  - **Not done in this unit:** no severity/sort filter wiring beyond
    the channel-filter dropdown and the priority/latest sort toggle in
    the list header (both did get wired, slightly ahead of the original
    "optional step 7" plan, since the underlying `conversation-views.ts`
    helpers made it nearly free); still no backend, still fixture data
    only; `currentCsrName` is still a hardcoded stand-in.

- **CodeRabbit review fixes on PR #2 (2026-08-23)** — 9 of 13 actionable comments addressed; the other 4 were deliberately skipped (see below).
  - **`conversation-pane.tsx`/`conversation-header.tsx`** — "Resolve" previously set `replyState` to `"replied"` directly, which made the composer falsely show "Sent by X" for a case nothing was ever sent on. `isResolved` is now separate local state, seeded from `replyState === "replied"` but only ever changed by the Resolve button; `ConversationHeader` takes `isResolved` as a prop instead of deriving it. "Mark as unattended" (previously an inert menu item) now calls `setReplyState("needs_reply")`.
  - **`composer.tsx`** — Enter-to-send now checks `event.nativeEvent.isComposing` / `keyCode === 229` first, so confirming an IME composition (Japanese/Chinese/Korean input) no longer sends the message mid-composition.
  - **`conversation-list-pane.tsx`** — switching the channel or assignment filter now clears the open conversation (`goTo` no longer threads `selectedId` through), since the previously-open case may not belong to the new filter. The sort toggle has its own handler and still preserves selection.
  - **`case-thread.ts`** — `caseLastActivityAt` now takes the max timestamp across the thread, `toolCallLog`, and `severityHistory`, not just the last message — a severity change or tool call can be more recent than the last post (confirmed against `case_1`, where this shifts the true last-activity time by 5 minutes).
  - **`ticket-sidebar.tsx`** — "New Ticket" button is now `disabled` when no `onNewTicket` callback is provided, instead of rendering enabled and doing nothing on click.
  - **`components/ui/checkbox.tsx`, `components/ui/separator.tsx`** — both used bare boolean-style Tailwind variants (`data-checked:`, `data-horizontal:`/`data-vertical:`) that never matched, because Radix sets `data-state="checked"` and `data-orientation="horizontal"` respectively, not literal `data-checked`/`data-horizontal` attributes. Fixed to `data-[state=checked]:` / `data-[orientation=...]:`. These are vendored shadcn files normally left untouched, but this is a correctness fix to the generator's own output, not a customization — flagged here so a future `shadcn add --overwrite` re-run doesn't silently reintroduce it unnoticed. `Checkbox` is unused anywhere in the app today; `Separator` is used for date dividers and was not visibly broken (the rest of its class list still rendered something), so this was a real but latent bug in both cases.
  - **`message-list.tsx`, `conversation-thread.tsx`** — date-divider grouping previously derived its key from `timestamp.slice(0, 10)` (the UTC calendar date) but rendered the header label via local-time formatting — the two could disagree near midnight depending on the viewer's timezone offset from UTC. Both the grouping key and the displayed label now derive from the same local `Date`. Verified visually: `msg_1` (`2026-08-21T16:05:00Z`, displayed as "12:05 AM") now correctly groups under "August 22" in a UTC+8 local timezone, where it previously showed "August 21" — a real header/timestamp mismatch, not just a style nit.
  - **`editor-navbar.tsx`, `conversation-message.tsx`** — added `aria-expanded` to the ticket-sidebar toggle button, and a visually-hidden "Private note:" label before private-note message bodies so screen readers announce their internal-only status (previously conveyed by color/icon alone).
  - **Deliberately not fixed — `proxy.ts` / simultaneous customer+admin sessions.** CodeRabbit's suggestion ("implement per-window session-token handling") isn't a real Clerk pattern — a single browser profile has one shared cookie jar across every tab/window, so two different signed-in users can never coexist there regardless of app code. The actual fix is operational, not code: use a second browser profile or an Incognito/Private window for the second role when demoing both sides at once. Already explained to and accepted by the user; no code change made.
  - Verified: `tsc`/`lint`/`build` all clean. Each behavioral fix (1, 3, 5, and the date-divider fix) re-verified live against the dev server via a temporary `proxy.ts` exemption (reverted, confirmed via `git diff proxy.ts` returning empty) — not just re-reading the diff. `/customer/dashboard` re-screenshotted; the date shift observed there is the fix working as intended, not a regression.

- **05-sqlite (U1–U2 of the orchestration plan) — Drizzle/SQLite data layer**
  - Rewrote `feature-specs/05-sqlite.md` from stale Prisma/Postgres content
    (leftover from before the Amex repackaging) into a table-by-table
    mapping of the existing mock types (`Ticket`, `ChatMessage`,
    `GrievanceCase`, `ActivityEvent`, `DashboardMetrics` in
    `lib/mock/types.ts`) onto real tables, so seeding is a port, not a
    redesign.
  - Installed `drizzle-orm`, `@libsql/client`, `drizzle-kit`, `tsx`. All
    database code lives under `it-agent/lib/sqlite/` (schema, client,
    seed, and `drizzle.config.ts` all together, per explicit user
    request — not split across `lib/db/` + a root config file).
  - `lib/sqlite/schema.ts` — 8 tables: `customers`, `cards`,
    `service_request` (shared by chat tickets and grievance cases,
    `channel` tells them apart, `customer_id` nullable for an unclaimed
    social case), `social_posts`, `severity_changes`, `chat_sessions`,
    `chat_messages`, `agent_actions` (shared audit table for both chat
    activity events and grievance tool-call logs — exactly one of
    `service_request_id` / `chat_message_id` is set per row, chosen over
    two separate tables so a cross-channel query never needs a `UNION`).
  - `lib/sqlite/client.ts` — one libSQL client for both environments: a
    `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` connection when set, else a
    local `file:local.db` (gitignored) for dev — same client either way,
    not a different fallback path. Cached on `global` in development.
  - `lib/sqlite/seed.ts` — ports `lib/mock/fixtures.ts` row-for-row:
    6 tickets + 4 grievance cases → 10 `service_request` rows, their
    `activityEvents`/`toolCallLog` → 10 `agent_actions` rows, plus 5
    `customers` (including one seeded `closed` with a still-open linked
    request, so the churn-metric success criterion has real data). Safe
    to re-run — clears every table first.
  - `package.json` scripts: `db:generate`, `db:migrate`, `db:studio`,
    `db:seed`, pointed at `lib/sqlite/drizzle.config.ts`.
  - Verified: migration generated and applied cleanly; seed run twice
    (idempotency confirmed); row counts checked directly (5 customers,
    10 service_requests, 10 agent_actions); `npx tsc --noEmit` and
    `npm run build` both clean.
  - **Not done in this unit:** `lib/db/queries.ts` for the four dashboard
    metrics (still fixture-computed, per `05-sqlite.md`'s note that these
    must be live queries, never stored counters) — deferred to whoever
    wires `04-project-dialogs` to real data.

- **06-project-api — service-request CRUD API routes**
  - `feature-specs/06-project-api.md` was pasted as a generic "Project"
    CRUD example (list/create/rename/delete, `ownerId`); there is no
    `projects` table in this app. Confirmed with the user and rewritten
    onto the real entity: `service_request`, the table shared by
    customer tickets and CSR grievance cases.
  - `app/api/service-requests/route.ts` (`GET` list, `POST` create) and
    `app/api/service-requests/[serviceRequestId]/route.ts` (`PATCH`
    rename, `DELETE`) — customer-scoped only; no CSR/admin surface here.
  - `lib/sqlite/queries.ts` (new) — `resolveCustomer()` finds the
    `customers` row for the signed-in Clerk user by `clerk_user_id`, or
    provisions one from the Clerk profile on first request (no seeded
    customer had `clerk_user_id` set, and this was already the
    documented U2 follow-up blocker — see Architecture Decisions).
    `listServiceRequestsForCustomer`, `createServiceRequest`,
    `getServiceRequestById`, `renameServiceRequest`,
    `deleteServiceRequest` round out the CRUD.
  - `lib/sqlite/schema.ts` — `service_request.intent` changed from
    `NOT NULL` to nullable: a customer-created request exists before
    classification runs (`lib/agent/classify.ts`, not built yet), so it
    genuinely has no intent yet. Migration
    `lib/sqlite/migrations/0001_tough_eddie_brock.sql` generated and
    applied.
  - `proxy.ts` — unauthenticated requests to `/api/*` now get a JSON
    `401` instead of a `307` redirect to the sign-in page (a redirect is
    not a usable response for a fetch client). Page routes are
    unaffected; verified `/customer/dashboard` and `/admin/conversations`
    still redirect as before.
  - IDs: `tkt_` + `crypto.randomUUID()` for new service requests,
    `cust_` + `crypto.randomUUID()` for auto-provisioned customers —
    matches the existing prefix convention, no sequential IDs.
  - Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
    clean. All four routes curl-tested against the dev server —
    unauthenticated `GET`/`POST`/`PATCH`/`DELETE` all return `401` JSON.
    Owner/not-found checks additionally verified live against a real
    signed-in Clerk session (2026-08-25): auto-provisioning confirmed in
    Drizzle Studio (`customers` row created with real `clerk_user_id`,
    name, email from the Clerk profile on first request), create/rename/
    delete round-tripped on the user's own ticket, renaming someone
    else's seeded ticket (`tkt_1`, owned by `cust_you`) returned `403`,
    and deleting a nonexistent id returned `404`.
  - **Not done in this unit:** UI is not wired to these routes (per
    spec, "Keep this backend-only").
  - **CodeRabbit fixes on PR #3 (2026-08-25):** 6 of 9 findings addressed.
    - `resolveCustomer()` had a real race: no unique constraint on
      `customers.clerk_user_id`, so two concurrent requests from the same
      new sign-in could each insert a separate customer row. Added a
      `uniqueIndex` on `clerk_user_id` (migration
      `0002_outgoing_gravity.sql`, NULLs stay distinct per SQLite so
      seeded rows without one are unaffected) and made the insert
      conflict-safe (`onConflictDoNothing` + re-fetch the winner).
      Verified with a script firing 10 concurrent `resolveCustomer()`
      calls for the same `clerk_user_id`: 1 row created, not 10 (deleted
      after confirming).
    - `seed.ts` — grievance cases with no `classification` fixture were
      defaulting `intent` to `"card_unblock_activation"` instead of
      `null`, contradicting the nullable-until-classified contract just
      added. Fixed to `null`, matching `classification_intent`.
    - `seed.ts` — the full clear-then-insert sequence now runs inside
      `db.transaction()` so a failure partway through rolls back instead
      of leaving the DB half-cleared.
    - `feature-specs/06-project-api.md` — the Security section
      contradicted itself (one line implied a missing-or-unowned id both
      return `404`, the next assigned unowned to `403`). Reworded to one
      unambiguous rule: `404` missing, `403` unowned. The shipped code
      was already correct; only the doc text was self-contradicting.
    - `feature-specs/05-sqlite.md` — updated stale `lib/db/` path
      references to `lib/sqlite/` (the actual location, per the
      `05-sqlite` unit's own Architecture Decision), and marked `intent`
      nullable in the table doc to match the schema.
    - `ai-workflow-rules.md` — Protected Files' "never touch
      `migrations/meta/`" reworded to "never hand-edit," since the
      generator's own output there must be committed, not avoided.
    - **Not fixed — flagged instead:** `closedAccountOpenGrievanceCount`
      (the churn dashboard metric) can't actually be computed from the
      current schema — `customers` has no closure timestamp and
      `service_request` has no status history, so "was this request
      still open *at* account closure" isn't derivable. Pre-existing gap
      from `05-sqlite`, not introduced by this PR; needs its own schema
      decision rather than expanding this PR's scope. Logged here as an
      open item, not silently left in the spec as if it were solved.

- **Hydration-mismatch fix — `SeverityHistory` (2026-08-25)**
  - `components/admin/severity-history.tsx` combined `month`/`day`/`hour`/
    `minute` into one `Intl.DateTimeFormat` call. Node's and the browser's
    ICU/CLDR data can disagree on the connector text a *combined*
    date+time formatter inserts ("Aug 19, 5:35 PM" server-side vs "Aug 19
    at 5:35 PM" client-side for the same input), which is exactly the kind
    of "external changing data" React's hydration diff flags — a real SSR
    mismatch, not a false positive.
  - Fixed by splitting into two formatters (date-only, time-only) joined
    with a separator this code controls, matching the pattern already used
    elsewhere (`conversation-message.tsx`, `conversation-thread.tsx`,
    `message-list.tsx`, `message-item.tsx` all format date and time
    separately — `severity-history.tsx` was the one outlier that combined
    them).
  - Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
    clean; confirmed the new formatter pair produces a deterministic
    string not dependent on locale-specific connector data.

- **04-project-dialogs (revision) — customer Ticket Status panel replaces
  the customer-side Agent Activity panel**
  - `components/editor/agent-activity-panel.tsx` deleted. The customer
    right column is now `ticket-status-panel.tsx`: status + priority
    badges, servicing area, a 4-step progress track
    (Raised → In progress → Escalated → Resolved), the escalation note,
    and a pinned "Escalate to admin" action bar. Same `<aside>` geometry
    as the panel it replaces, so the column widths are unchanged.
  - `components/shared/activity-panel.tsx` / `activity-event-row.tsx`
    untouched — the CSR case-detail tool-call log still uses them. Only
    the doc comment changed to stop describing a customer-side consumer.
  - New `components/shared/ticket-status-badge.tsx` exports both the badge
    and `ticketStatusLabel`, the single source of truth for the
    customer-facing labels. `ticket-sidebar.tsx` rows use it in place of
    the raw de-underscored status text.
  - `TicketStatus` deliberately keeps its stored values
    (`open | in_progress | resolved | escalated`) — "Raised" is a label,
    not a new state, so the union still mirrors `service_request.status`.
  - `Ticket` gained optional `escalatedAt` / `escalationReason`
    (`escalatedAt` mirrors the existing `service_request.escalated_at`
    column). `tkt_4` in the fixtures carries both so the populated state
    renders on load.
  - Escalation is a dialog (reused `EditorDialog` + `Textarea`) that
    requires a reason, flips the ticket to `escalated`, stamps
    `escalatedAt`, and appends an agent message to the thread. Local
    `useState` only — no API call, per the 04 spec boundary.
  - `intentLabel` lifted out of `chat-header.tsx` into
    `lib/mock/intent-labels.ts` and shared with the new panel;
    `intentLabelFor()` guards the null intent the real schema allows.
  - Timeline steps are stamped only where a real timestamp exists: Raised
    from `createdAt`, Escalated from `escalatedAt`, the current step from
    `updatedAt`. A passed step with no stored time of its own shows an em
    dash rather than borrowing `createdAt` — a resolved ticket must not
    claim it went in-progress the instant it was raised.
  - A guidance note sits above the escalate button: the three supported
    request types go to the agent in the chat, escalation is for urgent or
    unresolved cases. It renders only while escalation is available — when
    the button is disabled the slot carries the state caption instead, so
    the two never contradict each other. Placed in the panel footer rather
    than under the composer, which already carries the "agent can make
    mistakes" disclaimer.
  - Docs synced: `feature-specs/04-project-dialogs.md` (panel anatomy,
    the timestamp rule, and the guidance note),
    `context/ui-context.md` (right-panel pattern),
    `context/project-overview.md` (success criterion 2 and the feature
    bullet now scope Agent Activity to the CSR console).
  - Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
    clean; panel markup confirmed against the prerendered
    `.next/server/app/customer/dashboard.html` (title, 4-step track with
    tkt_3's stamps, guidance note, no "Agent Activity" anywhere). The
    click-through (submit a reason → badge flips in panel and sidebar)
    was not exercised — the route is Clerk-protected.

- **07-wire-ui-api — customer dashboard + admin console wired to real SQLite data**
  - Spec was pasted as a generic "wire the editor home sidebar and dialogs
    to the real project API" template (Liveblocks room IDs, owned/shared
    projects, workspace navigation) — none of that exists in this app.
    Reframed onto `service_request` and rewritten in
    `feature-specs/07-wire-ui-api.md`, covering both the customer dashboard
    and the admin console per explicit user direction.
  - **Scope, decided with the user:** customer side is list + create only
    (rename/delete dropped — doesn't fit real support-ticket UX, a
    customer editing/deleting their own case's audit trail is out of
    place in a servicing/compliance demo; the backend routes from
    `06-project-api` stay built, just not customer-facing). Admin side is
    read-only (sending a reply/private note stays local-state only —
    persisting CSR messages needs a new table and touches Invariant 5
    carefully, deferred to its own future unit). Dashboard: 3 of 4
    metrics real, `closedAccountOpenGrievanceCount` explicitly flagged
    "Not yet available" rather than faked (schema genuinely can't derive
    it — see Open Questions).
  - **Customer side:** `app/customer/dashboard/page.tsx` is now an async
    server component (`requireCustomer()` → `resolveCustomer()` →
    `listServiceRequestsForCustomer()`, all pre-existing) rendering the
    moved client component `components/customer/customer-dashboard.tsx`.
    `lib/mock/from-service-request.ts` (new) — `toTicket()`, the DB-row
    → `Ticket` mapping boundary. `Ticket.intent` widened to
    `Intent | null`. `hooks/useServiceRequestActions.ts` (new `hooks/`
    directory) — create-only, `POST /api/service-requests`.
  - **Admin side:** new reads in `lib/sqlite/queries.ts` —
    `listGrievanceCases()` (every `service_request` row across all
    channels, assembled with `customers`/`social_posts`/
    `severity_changes`/`agent_actions` into the `GrievanceCase` shape;
    no `relations()` declared on the schema, so this joins in JS rather
    than Drizzle's nested `with:` API — fine at this data volume),
    `getGrievanceCaseDetail(id)`, `computeDashboardMetrics()`. Both
    `severityChangedRecently` and `escalationsPastThreshold` use a
    documented 24-hour placeholder threshold — none was defined anywhere
    in the codebase before this.
  - **CSR identity:** `lib/mock/current-csr.ts`'s hardcoded
    `currentCsrName` constant is deleted. `lib/auth/session.ts`'s new
    `requireCsrName()` resolves the real signed-in CSR's name from the
    Clerk profile — no new DB table needed, since `contactedByCsrName`
    was already free-text, not a foreign key.
    `lib/admin/conversation-views.ts`'s `matchesAssignment()`/
    `filterCases()`/`countByAssignment()` now take `currentCsrName` as a
    parameter instead of importing the mock constant.
  - Wired: `app/admin/(console)/layout.tsx` (nav-rail counts),
    `.../conversations/layout.tsx` (list pane), `.../conversations/[id]/
    page.tsx` (case detail), `.../reports/grievances/page.tsx` (queue),
    `.../reports/dashboard/page.tsx` (metrics). The two reports pages
    carry `export const dynamic = "force-dynamic"` — neither calls a
    Next.js dynamic API on its own, so without this Next statically
    prerendered them at build time and froze the DB read at build time,
    caught by checking the build's route table (both showed `○` Static
    instead of `ƒ` Dynamic before the fix).
  - Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
    clean; build's route table confirms every touched route is now `ƒ`
    Dynamic. Unauthenticated requests to all four newly-wired page
    routes still correctly redirect (proxy.ts unaffected). Live
    sign-in-and-click-through verification (customer create round-trip,
    admin conversation list/detail against real seed data, the "Mine"
    filter against a real CSR name, the dashboard's 4th tile showing
    "Not yet available") was not re-exercised in this session — flagged
    for the user to confirm in-browser, same as `06-project-api`'s
    verification pattern.
  - **Not done in this unit:** CSR reply/private-note persistence (new
    table needed, deferred); the `closedAccountOpenGrievanceCount` schema
    gap remains open (see Open Questions).

- **08-persisted-messages — CSR replies, private notes, and real escalation**
  - Closes the gap `07-wire-ui-api` left open. No new table was needed:
    `chat_messages` already existed from `05-sqlite` and took two columns
    (`is_private_note`, and `author_role` widened to
    `customer | agent | csr`), plus `service_request.escalation_reason`.
    Migration `0003_fixed_jackpot`, applied to `local.db`.
  - **Invariant 5 upheld.** Every write is human-initiated (Send / Add
    note / Escalate) — no auto-send path and no flag that creates one.
    `"csr"` was added alongside the pre-existing `"agent"` role precisely
    so a human reply stays distinguishable from an eventual bot-authored
    one in the audit trail.
  - **API (new):** `POST`/`GET /api/service-requests/[id]/messages` —
    customer writes only to their own case, CSR to any; `isPrivateNote`
    honored only for a CSR sender (never trusted from a customer), and
    private notes stripped server-side from every customer read. A
    non-private CSR send also marks the case replied and stamps
    `contacted_by_csr_name`. `POST .../escalate` — one transaction:
    status/priority/severity bumped, `escalated_at` and
    `escalation_reason` recorded, a `severity_changes` row written, and
    the reason inserted into the thread as a customer message so the CSR
    sees *why* in the conversation, not just a timestamp. Authorship is
    always resolved server-side, never read from the request body.
  - **`lib/mock/case-thread.ts` — the swap point fired.**
    `buildCaseThread()` now merges social-origin `dedupePosts` with the
    case's persisted `realChatMessages` in timestamp order, synthesizing
    a seed message only when both are empty. `casePreviewText()` skips
    private notes — the list should preview the conversation, not the
    team's internal commentary on it.
  - **UI:** `conversation-pane.tsx` POSTs and appends the row the server
    wrote (server id/timestamp, not client-invented), then
    `router.refresh()` so list preview, queue, and nav counts stop
    disagreeing with the open thread — its `currentCsrName` prop is gone,
    the name comes back from the write. `reply-composer.tsx` and
    `editor/composer.tsx` take `onSend: () => Promise<boolean>` and clear
    the draft only on a confirmed write, so a failed send never loses
    text. `customer-dashboard.tsx` sends and escalates for real, loading
    each thread on selection rather than in an effect (no cascading
    render — `react-hooks/set-state-in-effect` caught the first attempt);
    the first ticket's thread is server-rendered in
    `app/customer/dashboard/page.tsx`, private notes filtered there too.
  - Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
    clean. Backend round-trip exercised directly against a throwaway copy
    of `local.db` (`tsx` script, `TURSO_DATABASE_URL` pointed at the
    copy): customer message + private note + CSR reply persist and read
    back, customer-visible count excludes the note (2 of 3), escalate
    sets `status=escalated`/`priority=high`/`escalated_at` and writes both
    the `severity_changes` row and the thread message, and
    `buildCaseThread()` renders all four in order. Unauthenticated
    requests still gate correctly (page routes 307 to sign-in, the
    messages route returns 401). **Not verified in-browser** — a
    signed-in click-through of send/note/escalate is still owed, same as
    `07-wire-ui-api`.
  - **Not done in this unit:** the AI-authored `"agent"` role is defined
    but nothing writes it yet (that's the `lib/agent/` pipeline);
    resolving a case still doesn't persist (`isResolved` remains local
    state in `conversation-pane.tsx`).

## In Progress

- None.

## Next Up

- **U3+ of the orchestration plan** — the agent pipeline itself:
  `lib/agent/classify.ts` (LLM classify call), `lib/agent/pipeline.ts`
  (deterministic priority → route → execute → verify), and
  `app/api/chat/route.ts` (the streaming chat route tying both together),
  built against the schema seeded in `lib/sqlite/`. Resolving a real
  `customer_id` from the Clerk session is no longer a blocker —
  `resolveCustomer()` in `lib/sqlite/queries.ts` (added in 06-project-api)
  does this and can be reused directly.
- **03-auth (rest)** — Clerk sign-in/sign-up, role-based routing, and the
  `proxy.ts` gate are done. `customers.clerk_user_id` linkage is now
  implemented as `resolveCustomer()` in `lib/sqlite/queries.ts` (find by
  `clerk_user_id`, or provision from the Clerk profile on first request) —
  used by the `06-project-api` routes. `lib/auth/session.ts` itself is
  unchanged and still only resolves the Clerk user id/role; callers that
  need an internal `customer_id` call `resolveCustomer()` with it.
- **Social grievance intake** (`docs/plans/2026-08-22-001-…`) — the data
  layer it needed (`social_posts`, `severity_changes` on
  `service_request`) now exists; still blocked on the classifier (U5).
  Demo-critical spine is S1 (channel adapter + fixtures), S2 (triage), S4
  (case bridge), S5 (CSR queue + case detail). S8 (dashboard) is
  confirmed in-scope, not optional — see the plan's Effort and Sequencing
  section before cutting anything under time pressure.
- Real severity/priority design tokens: `severity-badge.tsx` /
  `priority-badge.tsx` currently reuse the 3 existing state tokens
  (confirmed with the user as a stopgap, not a final design decision).

## Open Questions

- `closedAccountOpenGrievanceCount` (the churn dashboard metric,
  `05-sqlite.md`'s Dashboard metrics section) is not actually computable
  from the current schema: `customers` has no closure timestamp and
  `service_request` has no status history, so "was this request still
  open *at* the moment the account closed" can't be derived at read
  time. Flagged by CodeRabbit on PR #3. Needs a decision — either add
  persisted closure-time/status-history data, or redefine the metric as
  a current-state approximation — before whoever wires the dashboard to
  real queries builds against it.
- Spec `01-design-system` lists "No default light style appears" as a
  done-check while `ui-context.md` states the theme is **light only, no
  dark mode**. Implemented as: shadcn's *stock default* palette never
  shows through — every surface resolves to a token from `ui-context.md`,
  `color-scheme` is pinned to `light`, and no `prefers-color-scheme`
  variant is emitted. The `dark` variant is scoped to an explicit `.dark`
  ancestor that the app never sets, so the `dark:` utilities baked into
  the vendored `components/ui/*` files stay inert. Confirm this reading.
- ~~Spec `02-editor` asks for a navbar with a "dark background" while
  `ui-context.md` is light-only with no dark surface token.~~ **Resolved:**
  added dedicated chrome tokens rather than overloading `--action-neutral`,
  and documented them in `ui-context.md`. The theme stays light-only; the
  navbar is the single dark surface.
- Spec `02-editor` says the toggle icon is chosen "based on sidebar state"
  but not which way round. Implemented action-first: `PanelLeftOpen` when
  the sidebar is closed (click to open), `PanelLeftClose` when it is open.
  Flip if the intent was state-first.
- Spec `02-editor` specifies the navbar's left and right sections but says
  nothing about the centre. Rendered as an empty flex region, no content
  invented.
- Does a public acknowledgement get posted at all in the social-intake
  demo, or does the reply stop at "drafted and approved" to avoid any
  impression of publishing? (carried from the social intake plan's own
  Open Questions)
- What is the aging threshold that triggers escalation for a social
  grievance — hours for a demo, days in reality?

## Architecture Decisions

- Design tokens from `ui-context.md` are declared once in
  `app/globals.css` and mapped into Tailwind v4 via `@theme inline`, so
  shadcn's semantic variables (`--background`, `--primary`, …) resolve to
  product tokens rather than shadcn defaults. Reason: keeps generated
  `components/ui/*` files unmodified (they are vendored) while still
  enforcing the "no hardcoded hex" rule in feature code.
- Product tokens are also exported as Tailwind colour utilities
  (`bg-surface`, `bg-subtle`, `bg-accent-soft`, `bg-action-neutral`,
  `text-state-success`, `text-state-pending`, `text-state-error`) so the
  agent-activity status colours can be applied without hardcoded hex.
- Customer-facing surfaces never show tool-call detail. Agent telemetry
  (stage / status / mono parameters) is CSR-only; the customer sees a
  plain-language ticket lifecycle instead. Reason: the mono detail lines
  are operator diagnostics — useful to a CSR, noise to a cardmember — and
  the customer's real question is "where is my ticket", which the status
  timeline answers directly.
- Status display labels are decoupled from stored status values. The
  stored union mirrors the DB column; `ticketStatusLabel` maps it to
  customer wording ("open" → "Raised"). Reason: keeps the eventual swap
  from fixtures to `service_request` rows a drop-in.
- `components/editor/` holds chrome composed from the vendored primitives.
  The `components/ui/*` files stay untouched — every editor-specific style
  is applied at the call site via `className`, so re-running the shadcn CLI
  can never clobber product styling.
- `ProjectSidebar` positions itself with `absolute`, not `fixed`, so the
  editor shell that renders it owns the bounds. Consequence: **the shell
  must be `relative`** (and should clip with `overflow-hidden` so the
  off-screen sidebar does not create a scrollbar). Chosen over `fixed`,
  which would have hardcoded the navbar height into the sidebar.
- The `shadcn` package is a runtime dependency, not just a CLI: the
  preset's `app/globals.css` imports `shadcn/tailwind.css` for its
  `@utility` helpers (`scroll-fade`, `shimmer`, data-state variants).
- **Two roles, one login.** CSR and customer share a single Clerk-hosted
  sign-in and a single session shape; `publicMetadata.role`
  (`customer | csr`) decides which routes are reachable, exposed via a
  `sessionClaims.metadata.role` session-token claim. Chosen over separate
  auth doors, which would create two places invariant 1 can break.
  Consequence: once U2 lands, `customers.role` mirrors the Clerk metadata
  for joins/queries, but Clerk stays the source of truth.
- **Auth moved from Auth.js (NextAuth) Credentials to Clerk, 2026-08-22.**
  Simpler to wire (`clerk init` scaffolds provider, pages, env, and route
  protection in one pass) and drops the need to hand-roll password hashing
  against the `customers` table. See `feature-specs/03-auth.md` and the
  `03-auth (Clerk)` entry under Completed.
- **CSR is read-only over other customers' data.** It reviews
  `agent_actions`, escalated cases, and transcripts, and can close an
  escalation — but a CSR session never widens which customer an agent
  tool may act on. Invariant 1 is role-independent.
- **Repackaged from IT helpdesk to Amex servicing, 2026-08-22.** The
  pipeline shape (classify → prioritise → authenticate → execute → verify
  → confirm/escalate) is unchanged; only the domain underneath it moved —
  `employees` → `customers`, password reset/unlock/software access →
  Card Servicing / Transaction & Dispute Servicing / Account & Profile
  Servicing. See `context/project-overview.md` and `context/architecture.md`
  for the full reframing, and `docs/brainstorms/2026-08-21-agent-…` for the
  capability-scoping decisions that came just before it.
- **No dedicated agent orchestration layer.** The Amex synopsis states
  LLM calls should be invoked directly from the Next.js app, not through a
  separate orchestration framework. The Vercel AI SDK's tool-calling loop,
  called as a library from an API route, satisfies this while still being
  a real agent. Confirmed explicitly with the user rather than assumed —
  see `context/architecture.md`, Agent Architecture.
- **Database code lives under `lib/sqlite/`, not `lib/db/`.** The
  orchestration plan (`docs/plans/2026-08-14-001-…`) and
  `context/architecture.md`'s System Boundaries both say `lib/db/`; the
  user explicitly asked to keep schema, client, seed, and
  `drizzle.config.ts` together under one folder for this build. Everything
  the boundary rule protects ("only `lib/db/` touches the database") still
  holds — it's just named `lib/sqlite/` instead. `context/architecture.md`'s
  System Boundaries entry was updated to `lib/sqlite/` to match.
- **Social grievances are a second front door onto the same pipeline, not
  a second pipeline.** A social post triages, dedupes, and opens or
  attaches to an ordinary `service_request` row with `verified: false` on
  its customer link. No servicing tool executes from that link without an
  authenticated session claiming it. The agent drafts replies; only a
  human CSR sends — no auto-send path exists at any configuration. See
  `docs/plans/2026-08-22-001-feat-social-grievance-intake-plan.md`.
- **Customer auto-provisioning on first API request, 2026-08-24.** No
  seeded `customers` row has `clerk_user_id` set, so `resolveCustomer()`
  (`lib/sqlite/queries.ts`) creates one from the Clerk profile
  (email/name) the first time a signed-in customer hits an authenticated
  route, rather than failing closed until someone manually links the
  Clerk user to a seed row. Chosen so real sign-ins work out of the box;
  does not touch invariant 1 (the created row is keyed to that same
  session's `clerk_user_id`, never a client-supplied id).
- **`service_request.intent` is nullable, 2026-08-24.** Was `NOT NULL`
  since `05-sqlite`, but a customer creating their own ticket via
  `06-project-api`'s routes has not been classified yet — `intent` is
  the classifier's job (`lib/agent/classify.ts`, not built), distinct
  from `classification_intent` which already was nullable. Migration
  `0001_tough_eddie_brock.sql`.
- **`proxy.ts` returns JSON `401` for unauthenticated `/api/*` requests
  instead of redirecting, 2026-08-24.** The existing behavior (redirect
  to the sign-in page) was written for page navigation; a fetch client
  hitting an API route needs a real status code, not a `307` to HTML.
  Page routes are unaffected — only the `/api/*` branch changed.
- **Customer-side rename/delete UI dropped from `07-wire-ui-api`'s scope,
  2026-08-26.** The pasted generic template included them (a
  document/project list pattern); the user judged, and this was
  confirmed, that editing/deleting a service request's title or audit
  trail doesn't fit a servicing-and-compliance demo. The backend routes
  stay built and tested (`06-project-api`), just not exposed to
  customers. If a real need for either surfaces later, it's a UI-only
  addition — no backend work required.
- **CSR reply/private-note persistence deferred, 2026-08-26 —
  superseded the same day by `08-persisted-messages`.** It turned out to
  need no new table: `chat_messages` already existed and took two
  columns. Invariant 5 is untouched — every send is still human-initiated.
- **`severityChangedRecently` and `escalationsPastThreshold` use a
  24-hour placeholder threshold, 2026-08-26.** Neither threshold was
  defined anywhere in the codebase before `07-wire-ui-api` — a
  demo-reasonable default, documented in `lib/sqlite/queries.ts` and
  here rather than silently guessed. Revisit if a real product answer
  for either surfaces.
- **CSR identity comes from the live Clerk session, not a mock constant,
  2026-08-26.** `lib/mock/current-csr.ts` (`currentCsrName = "J.
  Alvarez"`) is deleted; `lib/auth/session.ts`'s `requireCsrName()`
  resolves the real signed-in CSR's display name instead. No new schema
  needed — `service_request.contacted_by_csr_name` was already a
  free-text column, not a foreign key to some CSR table that doesn't
  exist.

## Session Notes

- Stack in place before this unit: Next.js 16.3.0 (App Router), React 19,
  Tailwind CSS v4, TypeScript strict. App lives in `it-agent/`.
- Next.js treats `app/` folders starting with `_` as **private folders**,
  excluded from routing. The `app/_design-check/` route used to verify spec
  `01-design-system` was therefore type-checked but never actually
  prerendered — the "built and prerendered clean" note above overstates
  what that check proved. Verification routes for later units must use a
  non-underscore folder name (this unit used `app/editor-check/`).
- The shadcn CLI is v4 — `init` takes `-b <base>` and `-p <preset>`; the
  old `--base-color` flag no longer exists. This project used
  `-b radix -p nova`, which is why `components.json` reads
  `"style": "radix-nova"`.
- LLM provider: Bedrock (Claude), swappable via the AI SDK provider
  interface — the earlier Gemini-first plan changed once AWS sponsorship
  and Bedrock model access became the confirmed path. See
  `context/architecture.md`.
