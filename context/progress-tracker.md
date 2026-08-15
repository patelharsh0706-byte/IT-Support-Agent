# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- Feature specs `01-design-system` and `02-editor` are complete. Next unit is
  the three-column app shell that hosts the editor chrome.

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

## In Progress

- None.

## Next Up

- App shell layout: fixed left sidebar (~280px), flexible centre column,
  fixed right activity panel (~480px), separated by `--border-default`
  hairlines, per the layout patterns in `ui-context.md`.
- Remaining shadcn primitives `ui-context.md` calls for but spec
  `01-design-system` did not request: `select`, `checkbox`, `label`,
  `avatar`, `separator`, `badge`, `skeleton`. Add them with the CLI when
  the unit that needs them lands.

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
