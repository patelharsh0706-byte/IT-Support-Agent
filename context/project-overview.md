# IT Service Chat Agent

## Overview

An AI-powered IT helpdesk chat agent for the NUS-ISS "Show Me Your Agents" Hackathon (GOAI 2026 Agent Infra track). Employees sign in and submit IT support requests through a single chat interface. The agent identifies intent, classifies and prioritizes the request, retrieves relevant policy/context when needed, executes the appropriate backend action, verifies the outcome, and confirms resolution with the employee — or escalates to a human support agent when it can't resolve the issue.

## Goals

1. Automate the three most common IT helpdesk intents (Password Reset, Account Unlock, Software Access) end-to-end without human intervention.
2. Demonstrate a transparent, real-time view of agent reasoning and tool execution (the "Agent Activity" panel) alongside the chat.
3. Hit measurable KPIs: response accuracy [0/1], customer satisfaction score [1–5], successful query resolution rate [0–100%].

## Core User Flow

1. Employee signs in (Auth.js Credentials, backed by the `employees` table).
2. Employee opens the chat interface and submits a support request.
3. Agent identifies intent (Password Reset / Account Unlock / Software Access / other → escalate).
4. Agent classifies and prioritizes the request (Account Unlock > Password Reset > Software Access).
5. Agent generates a resolution plan, checking relevant state (e.g. current account status) where needed.
6. Agent executes the matching tool (`reset_password`, `unlock_account`, `request_software_access`).
7. Agent verifies the outcome by re-checking system state.
8. Agent confirms resolution with the employee, or escalates to human support if verification fails or the employee is unsatisfied.

## Features

### Chat & Agent Activity

- Single chat interface for submitting and resolving IT requests
- Live "Agent Activity" panel showing intent, priority, planned action, execution status, and verification result as they happen (streamed)

### IT Actions (Tools)

- `get_employee(employee_id)`
- `check_account_status(employee_id)`
- `reset_password(employee_id)`
- `unlock_account(employee_id)`
- `check_software_access(employee_id, software)`
- `request_software_access(employee_id, software)`

### Escalation

- Requests outside the three supported intents, or failed/unconfirmed resolutions, are escalated to human IT support

## Scope

### In Scope

- Chat UI + streaming agent activity panel
- Auth.js Credentials login backed by seeded employee data
- The 3 supported intents and their 6 backing tools, wired to a real SQLite (Drizzle) database
- Verification step after every executed action
- Escalation path when intent is unsupported or resolution fails

### Out of Scope (for the prototype)

- Real external IT systems (Active Directory, ticketing systems, etc.) — all actions operate on a mock database
- Background/async job processing (Trigger.dev) — deferred unless time permits an async approval demo
- Real-time multiplayer/collaboration (Liveblocks) — deferred unless time permits a live human-handoff demo
- Multi-tenant/org-level auth, SSO, or third-party identity providers

## Success Criteria

1. A signed-in employee can complete each of the three intents (password reset, account unlock, software access) fully through chat, with the database reflecting the change.
2. The Agent Activity panel visibly streams intent, priority, tool execution, and verification in real time during a demo.
3. A request outside the three intents (or a failed verification) is correctly escalated rather than silently failing.
