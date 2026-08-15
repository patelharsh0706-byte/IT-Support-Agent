# Architecture Context

## Stack

| Layer          | Technology                                  | Role                                                                 |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Framework       | Next.js (App Router) + TypeScript            | Frontend UI + API routes (single deployable app)                     |
| UI              | Tailwind CSS + shadcn/ui                     | Chat interface + live "Agent Activity" panel                         |
| Agent / LLM     | Vercel AI SDK                                | Tool-calling agent loop, streaming responses to the UI               |
| LLM Provider    | Gemini (free tier), swappable to Anthropic   | Model backing the agent — swap is a one-line change in the AI SDK    |
| Database        | SQLite via Turso (libSQL) + Drizzle ORM      | Persists employees, tickets, software_access, agent_actions, chat data. Turso hosts the DB so it survives Vercel's serverless filesystem |
| Auth            | Auth.js (NextAuth) — Credentials provider    | Employee login, session cookies, backed by the `employees` table     |
| Background jobs | None (prototype scope)                       | Deferred — add Trigger.dev only if an async approval demo is needed  |
| Real-time collab| None (prototype scope)                       | Deferred — add Liveblocks only if a live human-handoff demo is needed |
| Deployment      | Vercel (Hobby, free tier)                    | Hosting for the Next.js app                                          |

## System Boundaries

- `app/` — routes, pages, and API route handlers (chat endpoint, auth endpoint)
- `app/api/chat/` — receives chat requests, runs the AI SDK agent loop, streams responses + tool activity
- `app/api/auth/` — Auth.js Credentials provider route
- `lib/db/` — Drizzle schema, client, and seed data for the 6 tables
- `lib/tools/` — the 6 agent tool functions (`get_employee`, `check_account_status`, `reset_password`, `unlock_account`, `check_software_access`, `request_software_access`)
- `components/` — chat UI, agent activity panel, shadcn/ui primitives
- `components/ui/` — vendored shadcn primitives, added via the CLI and never hand-edited
- `components/editor/` — editor chrome composed from those primitives (navbar, project sidebar, shared dialog pattern)

## Storage Model

- **SQLite via Turso (libSQL), accessed through Drizzle**: All application data — `employees`, `tickets`, `agent_actions`, `software_access`, `chat_sessions`, `chat_messages`. Turso hosts the database over the network so it persists on Vercel's ephemeral serverless filesystem; Drizzle connects via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (Vercel env vars). Same connection works locally, so dev and prod share one setup.
- **Session cookies (Auth.js)**: JWT-based session, no separate session store required.

## Auth and Access Model

- Every employee signs in via a login form (Auth.js Credentials provider) checked against the `employees` table — no external auth provider or account required.
- Each chat session, ticket, and agent action is scoped to the signed-in `employee_id`.
- Only the signed-in employee can view or act on their own tickets/chat sessions; no cross-employee access.

## Invariants

1. Tool calls (`reset_password`, `unlock_account`, `request_software_access`) only run for the currently authenticated employee — never on an arbitrary `employee_id` passed from the client.
2. Every executed tool call is verified (a follow-up state check) before the agent confirms resolution to the employee.
3. Auth, database, and agent logic all run inside the single Next.js app — no separate backend service for the prototype.
4. Background/real-time services (Trigger.dev, Liveblocks) are not dependencies of the core demo flow — the 8-step agent loop must work end-to-end without them.
