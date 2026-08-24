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

## In Progress

- None.

## Next Up

- **U3+ of the orchestration plan** — the agent pipeline itself:
  `lib/agent/classify.ts` (LLM classify call), `lib/agent/pipeline.ts`
  (deterministic priority → route → execute → verify), and
  `app/api/chat/route.ts` (the streaming chat route tying both together),
  built against the schema seeded in `lib/sqlite/`. Session/auth wiring
  (below) should land alongside or just before this, since the pipeline
  needs a real `customer_id`.
- **03-auth (rest)** — Clerk sign-in/sign-up, role-based routing, and the
  `proxy.ts` gate are done. `customers.clerk_user_id` now exists in the
  schema (nullable) but is not yet populated or read anywhere —
  `lib/auth/session.ts` still stops at the Clerk user id rather than
  resolving an internal `customer_id`. Next step is linking the two.
- **Social grievance intake** (`docs/plans/2026-08-22-001-…`) — the data
  layer it needed (`social_posts`, `severity_changes` on
  `service_request`) now exists; still blocked on the classifier (U5).
  Demo-critical spine is S1 (channel adapter + fixtures), S2 (triage), S4
  (case bridge), S5 (CSR queue + case detail). S8 (dashboard) is
  confirmed in-scope, not optional — see the plan's Effort and Sequencing
  section before cutting anything under time pressure.
- Wire the `04-project-dialogs` UI (built, mock data only) to real data
  now that `lib/sqlite/` exists: replace `lib/mock/fixtures.ts` reads in
  the customer dashboard and the `/admin/conversations*` /
  `/admin/reports/*` routes with real queries, and add the
  `lib/db/queries.ts` dashboard-metrics functions noted above.
  `lib/mock/case-thread.ts`'s `buildCaseThread()` is the single swap
  point for real message data; the mock types in `lib/mock/types.ts`
  were shaped to match the schema for this.
- Real severity/priority design tokens: `severity-badge.tsx` /
  `priority-badge.tsx` currently reuse the 3 existing state tokens
  (confirmed with the user as a stopgap, not a final design decision).

## Open Questions

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
