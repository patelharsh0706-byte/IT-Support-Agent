# UI Context

## Theme

Light only. No dark mode. The design language is a clean productivity dashboard — near-white surfaces layered on a soft grey app background, thin hairline borders instead of shadows, generous whitespace, and a single violet accent reserved for primary actions. Chrome stays quiet so the conversation and the agent's activity carry the attention.

Colour is used to mean something, never to decorate. Violet marks the primary action, and the three state colours map directly to agent activity status (`running`, `ok`, `failed`).

## Colors

All components must use these tokens — no hardcoded hex values.

| Role              | CSS Variable       | Value     |
| ----------------- | ------------------ | --------- |
| App background    | `--bg-base`        | `#F7F7F8` |
| Surface (panels)  | `--bg-surface`     | `#FFFFFF` |
| Subtle fill       | `--bg-subtle`      | `#F4F4F5` |
| Primary text      | `--text-primary`   | `#18181B` |
| Muted text        | `--text-muted`     | `#71717A` |
| Primary accent    | `--accent-primary` | `#7C3AED` |
| Accent wash       | `--accent-soft`    | `#F3E8FF` |
| Neutral action    | `--action-neutral` | `#18181B` |
| Border            | `--border-default` | `#E4E4E7` |
| Error             | `--state-error`    | `#DC2626` |
| Success           | `--state-success`  | `#22C55E` |
| Pending           | `--state-pending`  | `#F59E0B` |

### Editor chrome

The editor navbar is the one dark surface in the light-only theme (feature
spec `02-editor`). It has its own tokens so `--action-neutral` keeps its
single meaning ("submit this message") rather than doubling as a chrome fill.

| Role                | CSS Variable             | Value     |
| ------------------- | ------------------------ | --------- |
| Chrome surface      | `--bg-chrome`            | `#18181B` |
| Chrome foreground   | `--bg-chrome-foreground` | `#FAFAFA` |
| Chrome hairline     | `--border-chrome`        | `#27272A` |

Chrome tokens are for the editor navbar only. Panels, cards, and inputs stay
on `--bg-surface` — a dark panel would break the light-only language.

Usage rules:

- `--bg-base` is the page. `--bg-surface` is every panel, card, and input. Never invert the two.
- `--bg-subtle` fills message bubbles, hover states, and inactive nav items.
- `--accent-primary` is reserved for the single primary action in a view. A second violet button in the same view means one of them is not primary.
- `--action-neutral` is the near-black used for the chat send button, distinguishing "submit this message" from "commit this record".
- Borders carry separation. Use `--border-default` hairlines rather than drop shadows.

### Agent activity status colors

The activity panel maps event status to colour directly:

| Event status | Token              | Treatment                          |
| ------------ | ------------------ | ---------------------------------- |
| `running`    | `--state-pending`  | Amber dot, subtle pulse            |
| `ok`         | `--state-success`  | Green dot, solid                   |
| `failed`     | `--state-error`    | Red dot, plus escalation notice    |

## Typography

| Role      | Font       | Variable      |
| --------- | ---------- | ------------- |
| UI text   | Geist Sans | `--font-sans` |
| Code/mono | Geist Mono | `--font-mono` |

Both ship with the Next.js scaffold. Mono is for tool names, parameters, and identifiers surfaced in the activity panel — never for prose.

| Role            | Size | Weight   |
| --------------- | ---- | -------- |
| Panel title     | 22px | 600      |
| Section label   | 13px | 500      |
| Body / message  | 15px | 400      |
| Nav item        | 15px | 500      |
| Metadata        | 13px | 400      |

Metadata (timestamps, file sizes, helper text) always uses `--text-muted`.

## Border Radius

| Context                     | Class          |
| --------------------------- | -------------- |
| Inline / small UI, buttons  | `rounded-lg`   |
| Inputs and message bubbles  | `rounded-xl`   |
| Cards / panels              | `rounded-2xl`  |
| Avatars and status dots     | `rounded-full` |

## Component Library

shadcn/ui on top of Tailwind. Components live in `components/ui/`. Add new components with the CLI rather than writing from scratch; treat generated files as vendored and do not hand-edit them.

Components this product needs:

- `button` — primary (violet), neutral (near-black), secondary (white with border), ghost
- `input`, `textarea`, `select`, `checkbox`, `label` — form and composer primitives
- `avatar` — with an online-status dot slot
- `card` — attachments, task rows, activity entries
- `separator` — date dividers and panel sections
- `scroll-area` — message list and activity list
- `badge` — intent and priority chips
- `skeleton` — loading state while history reloads

## Layout Patterns

The application is a three-column dashboard on a single full-viewport surface.

- **Shell:** fixed left sidebar, flexible centre column, fixed right panel. Columns are separated by `--border-default` hairlines, not gaps.
- **Left sidebar:** fixed width (~280px). Brand at top, primary nav below it, signed-in customer pinned to the bottom with a sign-out control. The active nav item takes a `--bg-subtle` fill.
- **Centre column:** pinned header (conversation title plus a context subtitle), scrollable message list, pinned composer at the bottom. A one-line disclaimer sits under the composer.
- **Right panel:** fixed width (~480px). Pinned header with title, status caption, and a close control; scrollable body; actions pinned to a bottom bar when the panel is actionable. This panel holds the Agent Activity stream.
- **Sign-in / sign-up (Clerk):** two-panel on large screens — left panel (`--bg-chrome`) carries a compact logo, tagline, and a short text-only feature list, no cards; right panel is a centred Clerk form on `--bg-base`. Small screens drop the left panel entirely: form only, no gradients, no hero imagery, no scroll-heavy content. **Revised 2026-08-22** — supersedes the earlier single-column centred-card login pattern now that auth is Clerk-hosted, not a custom form.

### Message list

Each turn renders as an avatar, an author name with a right-aligned timestamp, then the content block beneath. Customer and agent messages share the same alignment — differentiate by avatar and name, not by left/right positioning. Date dividers are centred labels flanked by hairlines.

Content blocks inside a message may be a text bubble, an attachment card, a task row with a checkbox, or a bubble with a trailing inline action button.

### Composer

A bordered container holding the text area, a row of icon actions (voice, attachment) on the left, and the send button on the right. A keyboard hint sits in the top-right of the field.

### Agent Activity panel

Renders the stage events streamed from the chat route, one row per stage, in order. Each row carries a status dot, the stage label, and an optional detail line in mono for tool names and results. Rows appear as events arrive rather than all at once, so the panel visibly progresses during a turn.

Terminal states render as a distinct closing row: a green confirmation, an amber clarification request, or a red escalation notice.

## Icons

Lucide React. Stroke-based icons only, no filled variants.

| Context           | Size    |
| ----------------- | ------- |
| Sidebar nav       | `h-5 w-5` |
| Inline / metadata | `h-4 w-4` |
| Buttons           | `h-4 w-4` |

Icons inherit `--text-muted` unless they sit inside a filled button, where they inherit the button's foreground colour.
