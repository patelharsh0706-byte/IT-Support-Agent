# Architecture Context

Amex Innovation Labs Hackathon Singapore 2026 — "Amex Intelligent Customer Service Automation Loop." Three servicing intents (Card Servicing, Transaction & Dispute Servicing, Account & Profile Servicing), each covering two issues per the synopsis's Table 1, plus a social-channel grievance intake feeding the same pipeline. The IT-helpdesk framing (password reset / unlock / software access) is retired; the pipeline shape it proved out carries forward unchanged.

## Agent Architecture

**A real agent loop, with no separate orchestration layer.** The synopsis is explicit: *"As agent orchestration is not required for this solution, LLM interactions will be invoked directly from the Next.js application framework rather than through a dedicated agent orchestration layer."* That rules out a standalone framework (LangGraph, Mastra, CrewAI) as a distinct service or runtime — not agentic behavior itself.

What "agentic, no orchestration layer" means concretely:

- The **Vercel AI SDK's tool-calling loop** is the entire agent runtime. It is a library called from inside a Next.js API route, not a service with its own process, queue, or deployment. This satisfies the synopsis literally: there is nothing to point at and call "a dedicated orchestration layer."
- The loop is **deterministic outside the two LLM calls**. The model classifies (intent, issue, parameters, confidence) and later composes the confirmation. Priority, routing, tool execution, and verification are plain TypeScript — no model call, no framework state machine. This is what makes the pipeline auditable, testable without mocking a model, and fast enough for a live demo.
- **One tool surface, three servicing scopes.** There is one AI SDK agent loop, not three separate agent instances. Card Servicing, Transaction & Dispute Servicing, and Account & Profile Servicing are enforced as **capability scopes** — a declared, read/write-classified subset of the tool registry per intent (`context/project-overview.md`, capability manifest). The authorization gate in front of every tool call, not a framework boundary, is what stops a Card Servicing turn from executing a Dispute tool.
- **Social intake reuses the same loop.** A grievance from X is classified by the identical function that classifies a chat message. There is no second agent for social; there is a second *front door* (`lib/channels/`) feeding the one pipeline.

If a future unit needs a genuinely different shape — parallel sub-agent fan-out, long-running background reasoning — that is the point at which introducing a framework becomes a real conversation, and one to have explicitly against the synopsis's stated preference, not by default.

## Stack

| Layer            | Technology                                  | Role                                                                 |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Framework         | Next.js (App Router) + TypeScript            | Frontend UI + API routes (single deployable app)                     |
| UI                | Tailwind CSS + shadcn/ui                     | Chat interface, live Agent Activity panel, CSR console + dashboard   |
| Agent / LLM       | Vercel AI SDK                                | Tool-calling agent loop (classify, confirm), streaming to the UI — no separate orchestration layer |
| LLM Provider      | Amazon Bedrock (Claude), swappable via the AI SDK's provider interface | Provider swap is a one-line change; Bedrock is the AWS-sponsorship integration point |
| Database          | SQLite via Turso (libSQL) + Drizzle ORM      | Persists customers, cards, transactions, service requests, and all servicing/audit data — see Storage Model |
| Auth              | Clerk                                        | Two Clerk-hosted sign-in doors (`/sign-in` customer, `/admin/sign-in` CSR, invite-only), same instance and session shape; `customer`/`csr` carried as a `publicMetadata.role` session claim |
| Social intake     | Channel adapter interface (`lib/channels/`)  | Normalizes posts from external channels into the same pipeline; fixture-backed for the demo, live-client stub for later — see `docs/plans/2026-08-22-001-feat-social-grievance-intake-plan.md` |
| Background jobs   | None (prototype scope)                       | The social sweep (`app/api/social/sweep/`) is triggered manually, not scheduled |
| Real-time collab  | None (prototype scope)                       | Deferred — add only if a live hand-off demo is needed                |
| Deployment        | Vercel (Hobby, free tier), or AWS App Runner / Fargate if a fuller AWS story is wanted | Streaming-safe hosting; either target works against the same build |

## System Boundaries

- `app/` — routes, pages, and API route handlers
- `app/api/chat/` — receives chat requests, runs the AI SDK agent loop, streams responses + tool activity
- `app/api/social/sweep/` — authenticated endpoint that ingests, triages, and dedupes social grievances into `service_request`
- `app/api/grievances/[id]/reply/` — records a CSR-sent reply; there is no code path that sends without an explicit human action
- `app/sign-in/`, `app/sign-up/` — Clerk-hosted auth screens, the customer door (self-serve)
- `app/admin/sign-in/` — Clerk-hosted auth screen, the CSR door (invite-only, no sign-up affordance)
- `app/editor/` — the customer-facing landing surface (chat interface lands here once built)
- `app/admin/grievances/` — the CSR console: queue, case detail, dashboard
- `lib/auth/` — session accessors (`requireCustomer()`, `requireCSR()`) that resolve the Clerk session and enforce role
- `lib/db/` — Drizzle schema, client, and seed data
- `lib/tools/` — the servicing tool functions, each declared into exactly one intent's capability scope
- `lib/agent/` — the classification stage, the deterministic pipeline (priority → route → execute → verify), and the capability/authorization gate
- `lib/channels/` — the social channel adapter interface and fixture implementation
- `lib/social/` — grievance triage, severity, dedupe, case bridging, reply drafting, aging
- `components/` — chat UI, agent activity panel, CSR console, shadcn/ui primitives
- `components/ui/` — vendored shadcn primitives, added via the CLI and never hand-edited
- `components/auth/` — `AuthSplitLayout`, the shared two-panel shell wrapping Clerk's `<SignIn />` / `<SignUp />`
- `proxy.ts` — Clerk middleware; gates every route except `/sign-in`, `/sign-up`, and `/admin/sign-in`, and additionally gates `/admin/*` on `sessionClaims.metadata.role === "csr"`

## Storage Model

- **SQLite via Turso (libSQL), accessed through Drizzle.** Turso hosts the database over the network so it survives Vercel's ephemeral serverless filesystem; Drizzle connects via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`. Same connection locally and in production.
- **Core tables**: `customers`, `cards`, `transactions`, `service_request`, `intent`, `request_type`, `verification`, `service_action`, `escalation`, `resolution`, `agent_actions`, `chat_sessions`, `chat_messages` — the shape and rationale live in the orchestration and social-intake plans, not duplicated here.
- **Social intake adds**: `social_post` (linked to `service_request`), a `severity_change` audit table, and on `service_request` itself: `channel`, `current_severity`, `escalated_at`, `replied_by` / `replied_at`. Case age and customer retention status are **always derived at read time** from `social_post` and the linked customer record — never stored, so neither can drift or go stale.
- **Session (Clerk)**: Clerk manages the session cookie/JWT; no separate session store required.

## Auth and Access Model

- **Two Clerk-hosted doors, one instance, one session shape.** `/sign-in` (+ `/sign-up`) is the self-serve customer door; `/admin/sign-in` is the CSR door — invite-only, no sign-up affordance. Both render the same Clerk `<SignIn />` and produce the same session shape; which door was used is presentation only (badge + copy) and is **never** an authorization signal. `publicMetadata.role` (`customer | csr`) on the Clerk user, exposed as a `sessionClaims.metadata.role` session-token claim, decides what is reachable after sign-in — see `feature-specs/03-auth.md`. A user defaults to `customer` on sign-up; `csr` is granted by setting `publicMetadata.role` for that user out-of-band (Clerk Dashboard or `clerk users create`), not self-serve.
- **`customer`** — lands on `/editor` (the chat interface, once built). Each chat session, service request, and agent action is scoped to the signed-in customer; no cross-customer access.
- **`csr`** — Customer Service Representative, lands on `/admin`. Reviews executed tool calls, escalations, and social grievances; drafts and sends replies; closes escalations. A `csr` session does **not** gain the ability to run servicing tools on another customer's behalf — invariant 1 holds for every role.
- `lib/auth/session.ts` exports the only session accessors (`requireCustomer()`, `requireCSR()`). No tool, route, or component reads the session directly.
- Route protection lives in `proxy.ts` — Next.js 16 deprecated the `middleware.ts` convention and renamed it. It gates every route except `/sign-in`, `/sign-up`, and `/admin/sign-in`, and additionally requires `role === "csr"` for `/admin/*`; a `customer` hitting `/admin/*` gets rewritten to `/404`, not redirected, so the surface isn't advertised. An unauthenticated request to `/admin/*` redirects to `/admin/sign-in` specifically; everywhere else redirects to `/sign-in`.
- Once U2 lands, `customers.clerk_user_id` links the Clerk identity to the internal customer record; until then, `lib/auth/session.ts` resolves the Clerk user id and role only, not an internal `customer_id`.

## Invariants

1. Servicing tool calls only run for the currently authenticated customer — never on an arbitrary `customer_id` passed from the client, the model, or a social post. This holds for every role and every intake channel: a `csr` session, and a social grievance's soft-linked (`verified: false`) customer, never widen which customer a tool may act on.
2. Every executed tool call is verified — an independent, read-only re-check of state — before the agent confirms resolution. The action tool is never its own witness.
3. Every tool call is authorized against the calling intent's declared capability scope before it executes. An out-of-scope call is rejected and logged, not silently allowed.
4. **No servicing action is ever taken on the authority of an unauthenticated channel.** A social post is a hint, not an identity — it opens or attaches to a case, never executes a mutation.
5. **The agent never publishes.** Any reply drafted from a social grievance requires an explicit human send; there is no configuration path that removes that step.
6. Auth, database, and agent logic all run inside the single Next.js app — no separate backend service, and no separate agent-orchestration service, for the prototype.
7. Background/real-time services are not dependencies of the core demo flow — the servicing pipeline and the social console must both work end-to-end without a scheduler.
