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
  plans. Nothing in `it-agent/lib/` implements either yet — vocabulary and
  UI-layer work only so far.

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
  - **Scope note:** this unit's project-sidebar (My Projects / Shared
    tabs) does not map onto the Amex framing or either active plan. Kept
    dormant rather than deleted; do not build on top of it without
    confirming it still belongs.

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

## In Progress

- None.

## Next Up

- **U1–U2 of the orchestration plan** (`docs/plans/2026-08-14-001-…`) —
  dependencies, env validation, and the data layer. Nothing in
  `it-agent/lib/` exists yet: no `drizzle-orm`, no `@libsql/client`, no
  `lib/db/`. This blocks everything below.
- **03-auth (rest)** — Clerk sign-in/sign-up, role-based routing, and the
  `proxy.ts` gate are done. What remains is blocked on U1–U2: the
  `customers.clerk_user_id` / `customers.role` columns, so
  `lib/auth/session.ts` can resolve an internal `customer_id` instead of
  stopping at the Clerk user id.
- **Social grievance intake** (`docs/plans/2026-08-22-001-…`) — blocked on
  the data layer and the classifier (U5). Demo-critical spine is S1
  (channel adapter + fixtures), S2 (triage), S4 (case bridge), S5 (CSR
  queue + case detail). S8 (dashboard) is confirmed in-scope, not
  optional — see the plan's Effort and Sequencing section before cutting
  anything under time pressure.
- App shell layout: fixed left sidebar (~280px), flexible centre column,
  fixed right activity panel (~480px), separated by `--border-default`
  hairlines, per the layout patterns in `ui-context.md`.
- Remaining shadcn primitives `ui-context.md` calls for but spec
  `01-design-system` did not request: `select`, `checkbox`, `avatar`,
  `separator`, `badge`, `skeleton`. Add them with the CLI when the unit
  that needs them lands — the CSR console (queue table, severity/status
  badges) will need several of these.

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
