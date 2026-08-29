# Code Standards

How code in `it-agent/` must be written. These are rules, not preferences.
Where a rule and an invariant in `architecture.md` appear to conflict, the
invariant wins and the conflict gets logged in `progress-tracker.md`.

## General

- Keep modules small and single-purpose. A file that owns both a data shape
  and the UI that renders it owns too much.
- Fix root causes. Do not layer a guard over a bug you have not explained.
- Do not mix unrelated concerns in one component or route. A route handler
  that authenticates, mutates, and formats a response body should call three
  things, not inline three responsibilities.
- Derive, do not duplicate. Case age, time-in-escalation, and retention
  status are computed at read time from their source rows — never stored,
  so they cannot drift (`architecture.md`, Storage Model).
- Comments explain *why*, not *what*. When a decision traces back to a
  context file or a spec, name the file in the comment — the existing code
  does this (see `lib/sqlite/client.ts`, `proxy.ts`).
- Match the formatting of the file you are editing. There is no Prettier
  config; quote style and semicolons vary by file. Never reformat a file you
  are not otherwise changing.

## Naming and Exports

- Files: `kebab-case.ts` / `kebab-case.tsx` (`conversation-list-pane.tsx`).
- React components: `PascalCase`, exported by name. No default exports
  outside `app/` (Next.js requires them for `page.tsx` / `layout.tsx`).
- Props interfaces are named `<ComponentName>Props` and declared above the
  component (see `components/admin/nav-link.tsx`).
- Database column names are `snake_case`; the Drizzle field that maps them is
  `camelCase` (`clerkUserId: text("clerk_user_id")`).
- Import internal modules through the `@/*` alias, never a relative path that
  climbs out of its own folder (`@/lib/utils`, not `../../lib/utils`).

## TypeScript

- Strict mode is on and stays on. Do not weaken `tsconfig.json` to make an
  error go away.
- No `any`. Use an explicit interface, a narrow union, or `unknown` plus a
  check at the boundary.
- Validate unknown external input — request bodies, LLM tool arguments,
  social-post payloads — before trusting it. Anything crossing a system
  boundary is `unknown` until proven otherwise.
- Model closed sets as string unions, and keep the union identical to the
  Drizzle `enum` for the same column. `lib/mock/types.ts` and
  `lib/sqlite/schema.ts` must agree; when they diverge, the schema is right.
- Prefer inferred return types for internal helpers; annotate exported
  functions whose shape is part of a contract.
- Add a JSDoc block to any exported function whose behavior is not obvious
  from its name — especially when it throws (`lib/auth/session.ts`).

## Next.js (App Router, v16)

- Default to server components. Add `"use client"` only when the file needs
  browser interactivity (state, effects, event handlers), and push it as far
  down the tree as possible.
- Route protection lives in `proxy.ts`. Next.js 16 renamed the `middleware.ts`
  convention — do not create a `middleware.ts`.
- This is not the Next.js in your training data. Check the relevant guide in
  `it-agent/node_modules/next/dist/docs/` before relying on an API you
  remember rather than one you verified (`it-agent/AGENTS.md`).
- Fetch data in server components and pass plain serializable props down.
  Client components do not query the database.
- Route groups (`app/admin/(console)/`) carry shared layout without adding a
  URL segment. Use them instead of duplicating chrome across pages.
- **Never read identity from a client hook in a server-rendered component.**
  `useUser()` has no user during the SSR pass and the real one after
  hydration, so the two renders disagree by construction. Resolve it on the
  server (`requireCsrProfile()`) and pass plain props down — the same rule as
  every other data read, and it removes a hydration error rather than
  suppressing one.
- **Clerk components that mount themselves must be wrapped in `<ClerkLoaded>`.**
  `<UserButton />` and friends render a host element whose attributes differ
  between the server pass and the client one
  (`data-clerk-component={null}` vs `"UserButton"`), which React reports as a
  hydration mismatch — and it blames the *sibling* nodes, so the stack trace
  points at innocent markup. Pair it with a `<ClerkLoading>` placeholder of the
  same dimensions so the layout does not shift. Both call sites do this; copy
  the pattern rather than inventing a `useEffect` mounted-flag.
- **Moving or renaming a route file? Restart the dev server and clear
  Turbopack's cache first — `rm -rf it-agent/.next/dev`.** Turbopack does not
  recover from a route disappearing underneath a running `next dev`. Its
  incremental cache keeps a reference to the deleted page, tries to rebuild it
  on every hot-reload tick, and panics:

  ```
  FATAL: Failed to write app endpoint /admin/(console)/<old-path>/page
  Cell ... no longer exists in task ... directory_tree_to_loader_tree
  ```

  The browser then reloads in a loop, which reads as "the app is broken" or
  "I can't log in" — the page never survives long enough to finish a sign-in.
  Two things that will *not* warn you: `npm run build` passes and prints a
  correct route table (it is a separate production build and says nothing
  about the running dev server), and the page still returns a plausible HTTP
  status. **Check `next dev`'s own output for `FATAL` after any route move.**
  Learned the hard way on 2026-08-28 moving `reports/agent/twitter` to
  `agents/twitter`.
- The same staleness bites `tsc`: `.next/types/validator.ts` is generated and
  keeps referencing the old path after a move, so `npx tsc --noEmit` reports a
  missing module that is not a real error. `rm -rf it-agent/.next/types` and
  rebuild to regenerate it.

## Styling

- Use the CSS custom property tokens from `ui-context.md`. No hardcoded hex
  values, anywhere.
- Follow the border-radius scale in `ui-context.md`. Do not invent a radius.
- Compose class names with `cn()` from `@/lib/utils`. Do not concatenate
  class strings by hand or with template literals.
- Separation is carried by `--border-default` hairlines, not drop shadows.
- `--accent-primary` marks the single primary action in a view. A second
  violet button in the same view means one of them is not primary.
- When two elements must align on a shared grid, export one template class
  and use it in both (see `lib/admin/queue-grid.ts`). Do not repeat column
  definitions.

## API Routes

- Parse and validate request input before any logic runs. Reject malformed
  input with a 400 and no side effects.
- Resolve the session through `lib/auth/session.ts` (`requireCustomer()` /
  `requireCSR()`) before any mutation. No route, tool, or component reads the
  Clerk session directly.
- **Never trust a `customer_id` from the client, the model, or a social
  post.** The acting customer comes from the authenticated session, always
  (`architecture.md`, Invariant 1).
- Authorize every tool call against the calling intent's declared capability
  scope before it executes. An out-of-scope call is rejected *and logged* —
  never silently allowed (Invariant 3).
- Verify every executed action with an independent read-only re-check before
  confirming resolution. The action tool is never its own witness
  (Invariant 2).
- Return consistent response shapes: a success payload, or
  `{ error: string }` with a meaningful status code. Do not return 200 with
  an error body.
- Never let an internal error message, stack trace, or SQL fragment reach the
  client.

## Data and Storage

- All database access goes through the Drizzle client exported from
  `lib/sqlite/client.ts`. No second client, no raw `@libsql/client` calls in
  feature code.
- Schema changes go in `lib/sqlite/schema.ts`, followed by
  `npm run db:generate` and a committed migration under
  `lib/sqlite/migrations/`. Never hand-edit a generated migration or the
  snapshot files in `migrations/meta/`.
- Never edit `local.db` by hand. Reshape the seed (`lib/sqlite/seed.ts`) and
  re-run `npm run db:seed`.
- Metadata belongs in the database. Large generated content (transcripts,
  blobs) belongs in file or blob storage — do not store it in a column.
- Foreign keys declare their delete behavior explicitly (`cascade` where the
  child is meaningless without the parent, `set null` where it survives).
- Timestamps are stored as text defaulting to `(current_timestamp)`, matching
  the existing tables.
- Secrets come from environment variables and are documented in
  `.env.example`. Never commit `.env.local`, and never inline a key.

## File Organization

- `app/` — routes, pages, layouts, and API route handlers only
- `app/api/` — route handlers; one responsibility per handler
- `components/` — feature components, grouped by surface (`admin/`,
  `editor/`, `auth/`, `shared/`)
- `components/ui/` — vendored shadcn primitives, added via the shadcn CLI and
  **never hand-edited** (see Protected Files in `ai-workflow-rules.md`)
- `components/shared/` — components used by more than one surface; promote
  here rather than importing across `admin/` and `editor/`
- `lib/auth/` — the only session accessors in the codebase
- `lib/sqlite/` — Drizzle schema, client, config, seed, and migrations
- `lib/admin/` — CSR-console-specific view logic and shared layout constants
- `lib/mock/` — fixtures and their types; the shape the database must match
- `lib/tools/` — servicing tool functions, each declared into exactly one
  intent's capability scope *(planned)*
- `lib/agent/` — classification, the deterministic pipeline, and the
  capability/authorization gate *(planned)*
- `lib/channels/` — social channel adapter interface + fixture impl *(planned)*
- `lib/social/` — triage, severity, dedupe, case bridging, reply drafting,
  aging *(planned)*
- `proxy.ts` — Clerk middleware and route gating; nothing else

## Definition of Done

Before a unit is considered complete:

1. `npm run build` passes.
2. `npm run lint` passes with no new warnings.
3. Every invariant in `architecture.md` still holds.
4. Any context file the change invalidated has been updated in the same step.
5. `progress-tracker.md` reflects the completed work.
