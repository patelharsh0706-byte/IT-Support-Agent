# Amex Intelligent Customer Service Automation Loop

## Overview

An AI-powered customer service automation loop built for the American Express Innovation Labs Hackathon Singapore 2026. A cardholder signs in and submits a servicing request — or a grievance is picked up from a social channel — and the system identifies intent, classifies and prioritizes it, authenticates the customer, executes the appropriate servicing action, verifies the outcome, and confirms resolution — or escalates to a human Customer Service Representative (CSR) when it can't resolve the issue. The same pipeline drives three specialized intents: Card Servicing, Transaction & Dispute Servicing, and Account & Profile Servicing.

## Goals

1. Automate the six most common servicing issues (two per intent, see Intents below) end-to-end without human intervention, while respecting authentication and policy at every step.
2. Demonstrate a transparent, real-time view of agent reasoning and tool execution (the "Agent Activity" panel) alongside the chat, and a CSR console that gives human staff the same visibility over grievances they didn't see live.
3. Hit measurable KPIs: response accuracy [0/1], customer satisfaction score [1–5], successful query resolution rate [0–100%].

## Core User Flow

1. Customer signs in (Auth.js Credentials, backed by the `customers` table), or a grievance arrives from a social channel and is triaged without an authenticated session.
2. Customer opens the chat interface and submits a request — or the social sweep ingests a public grievance.
3. Agent identifies intent and issue (see Intents), or `other` → escalate.
4. Agent classifies and prioritizes the request per the issue's default priority (see Table below), authenticates the customer, and validates applicable policy.
5. Agent generates a resolution plan, checking relevant state (e.g. card status, transaction details) where needed.
6. Agent executes the matching servicing tool, only if the tool is in the calling intent's declared capability scope.
7. Agent verifies the outcome by independently re-checking system state — the action tool is never its own witness.
8. Agent confirms resolution with the customer, or escalates to a human CSR if verification fails, the customer is unsatisfied, or the case came from an unauthenticated channel and needs a human-sent reply.

## Intents and Issues

| Intent | Issue | Priority |
| --- | --- | --- |
| Card Servicing | Card Unblock | High |
| Card Servicing | Card Activation | Medium |
| Transaction & Dispute Servicing | Unrecognized Transaction | High |
| Transaction & Dispute Servicing | Duplicate Charge | Medium |
| Account & Profile Servicing | Update Phone Number | Medium |
| Account & Profile Servicing | Update Email | Low |

Priority is the issue's declared default and may be raised by the classifier's severity signals; it is never lowered.

**Dispute terminal state.** Card Servicing and Account & Profile Servicing issues resolve to `resolved` or `escalated` in one turn. Transaction & Dispute Servicing issues do not: under Regulation Z (credit card, not debit), a valid dispute suspends the charge and opens an investigation running 30–90 days. The correct terminal state for a dispute is **initiated** — charge suspended, investigation opened, timeline communicated — not `resolved`. Modeling a dispute as instantly resolved would misstate how card disputes actually work.

## Features

### Chat & Agent Activity

- Single chat interface for submitting and resolving servicing requests
- Live "Agent Activity" panel — CSR-facing — showing intent, priority, planned action, execution status, and verification result as they happen (streamed)
- Customer-facing Ticket Status panel showing the ticket lifecycle and an "escalate to admin" action, in place of agent telemetry

### Servicing Tools

One tool registry, partitioned into **capability scopes** — each intent may only call the tools declared into its scope, enforced by an authorization gate in front of every call (see `context/architecture.md`, Invariant 3). Concrete tool signatures are defined against the data model in `docs/plans/2026-08-14-001-feat-agent-orchestration-pipeline-plan.md`, retargeted from IT tooling to servicing tooling: get customer/card/transaction state, execute an eligible servicing action (unblock, activate, initiate dispute, update profile field), and the matching read-only verifier for each.

### Escalation

- Requests outside the six supported issues, or failed/unconfirmed resolutions, are escalated to a human CSR
- A social-channel grievance that the agent cannot resolve, or that requires a human-sent reply, escalates the same way

### Social Grievance Intake

- A channel adapter (X, to start) sweeps public posts for customer grievances, classifies and deduplicates them into the same service-request pipeline used by chat
- A social identity is a **hint, never an authentication** — a grievance links to a customer record with `verified: false` until an authenticated session claims it; no servicing tool ever executes on the authority of a social post
- The agent drafts a reply; **a human CSR must explicitly send it**. There is no auto-send path, at any configuration
- Full detail: `docs/plans/2026-08-22-001-feat-social-grievance-intake-plan.md`

### CSR Console

- A queue of open grievances (chat escalations and social cases together), ordered by priority then age
- Per case: the grievance itself, current severity (which may change after intake), case age, time-in-escalation, customer retention status (`active` / `closed` / `unknown`), and which CSR (if any) has made contact
- A dashboard rolling those up: open grievances by severity, oldest unanswered case, escalations past threshold, and customers who churned while a grievance was open — the metric that prices the problem, not just tracks it

## Scope

### In Scope

- Chat UI + streaming agent activity panel
- Auth.js Credentials login backed by seeded customer data — one login form at two doors (`/login`, `/admin/login`), two roles (`customer`, `csr`)
- The 6 supported issues across 3 intents, wired to a real SQLite (Drizzle) database, with tool access enforced by capability scope
- Verification step after every executed action
- Escalation path when intent is unsupported, resolution fails, or a social case needs a human
- Fixture-backed social grievance intake for X, with dedupe and severity tracking
- CSR console: grievance queue, case detail, dashboard — see Features above

### Out of Scope (for the prototype)

- Real external systems (core banking, card networks, ticketing) — all actions operate on a mock database
- Live social API integration — the channel adapter interface exists; only a fixture implementation ships
- Background/async job processing (Trigger.dev) — the social sweep is triggered manually, not scheduled
- Real-time multiplayer/collaboration (Liveblocks) — deferred unless time permits a live human-handoff demo
- Multi-tenant/org-level auth, SSO, or third-party identity providers
- A dedicated agent-orchestration framework (LangGraph, Mastra, CrewAI, or similar) as a separate service — the synopsis explicitly asks for LLM calls invoked directly from the Next.js app; see `context/architecture.md`, Agent Architecture

## Success Criteria

1. A signed-in customer can complete each of the six supported issues fully through chat, with the database reflecting the change — dispute issues confirm **initiation**, not instant resolution.
2. The Agent Activity panel in the CSR console visibly streams intent, priority, tool execution, and verification during a demo. The customer side shows the same request as a plain-language Ticket Status timeline (raised / in progress / escalated / resolved) rather than tool-call detail.
3. A request outside the six issues, or a failed verification, is correctly escalated rather than silently failing — and a CSR can see that escalation, with the tool calls that led to it, in the console.
4. A social grievance (seeded from fixtures) is triaged, deduplicated against a repeat post, and appears in the CSR queue with its age and current severity — and can only be replied to by an explicit human send.
5. The dashboard reports at least one customer whose account shows `closed` while a grievance was open, demonstrating the retention-cost metric with real seed data.
