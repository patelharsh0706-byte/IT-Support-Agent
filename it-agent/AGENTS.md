<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Application Building Context

This directory is the **source of truth** for what to build and how to build it. These files are specs, not suggestions — implement against them, do not infer or invent behavior from scratch.

## Read these files in order — before implementing or making ANY architecture decision

Read all six, top to bottom, every time you start work or weigh a design choice. Each builds on the ones above it.

1. **[project-overview.md](project-overview.md)** — *What we're building and why.*
   The product, the core 8-step user flow, the 3 supported intents, scope boundaries, and the measurable success criteria (KPIs). This is the north star — every decision serves this.

2. **[architecture.md](architecture.md)** — *How the system is structured.*
   Stack, system flow diagram, system boundaries (which folder owns what), storage model, auth/access model, and the **Invariants**. Nothing you build may violate an invariant here.

3. **[ai-workflow-rules.md](ai-workflow-rules.md)** — *How to work.*
   Scoping rules (one feature unit at a time), when to split work, how to handle missing or ambiguous requirements, protected files, keeping docs in sync, and the "before moving to the next unit" checklist.

4. **[code-standards.md](code-standards.md)** — *How the code must be written.*
   General principles, TypeScript rules, framework conventions, API-route rules, and data/storage rules. Follow these when writing any code.

5. **[ui-context.md](ui-context.md)** — *How the interface must look and behave.*
   Theme, color tokens, typography, border-radius scale, component library, and layout patterns. Use the defined tokens — no hardcoded values.

6. **[progress-tracker.md](progress-tracker.md)** — *Where we are right now.*
   Current phase, current goal, completed/in-progress/next-up work, open questions, and architecture decisions. Read this last to know what state the build is in and what to pick up next.

## Rules that override default behavior

- **Specs first.** If behavior isn't defined in these files, do not invent it. Resolve the ambiguity in the relevant context file first, or log it under *Open Questions* in [progress-tracker.md](progress-tracker.md) before continuing.
- **Invariants are non-negotiable.** Before any change, confirm it upholds every invariant in [architecture.md](architecture.md) (e.g. `employee_id` always comes from the authenticated session, never from client/LLM input; every executed tool call is verified before confirming resolution).
- **Keep docs in sync.** When implementation changes architecture, boundaries, storage, standards, or scope, update the matching context file in the same step.
- **Update progress after every meaningful change.** [progress-tracker.md](progress-tracker.md) must reflect completed work before moving to the next unit.

> Note: this file governs the **application-building context** in `context/`. The separate `it-agent/AGENTS.md` carries framework-specific (Next.js) rules for the app itself — read that too before writing code in `it-agent/`.
