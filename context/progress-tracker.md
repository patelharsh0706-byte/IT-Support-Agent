# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- In progress

## Current Goal

- Feature spec `01-design-system` is complete. Next unit is the app shell
  layout.

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
- The `shadcn` package is a runtime dependency, not just a CLI: the
  preset's `app/globals.css` imports `shadcn/tailwind.css` for its
  `@utility` helpers (`scroll-fade`, `shimmer`, data-state variants).

## Session Notes

- Stack in place before this unit: Next.js 16.3.0 (App Router), React 19,
  Tailwind CSS v4, TypeScript strict. App lives in `it-agent/`.
- The shadcn CLI is v4 — `init` takes `-b <base>` and `-p <preset>`; the
  old `--base-color` flag no longer exists. This project used
  `-b radix -p nova`, which is why `components.json` reads
  `"style": "radix-nova"`.
