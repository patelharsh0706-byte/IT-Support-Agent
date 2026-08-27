# Project Dialogs & Editor Home

## Goal

Build the dashboard for both customer and admin dashboard. No API calls or persistence yet.

## Dashboard Home

Reuse the existing editor layout. Do not modify the navbar or sidebar behavior.

Customer dashboard
    - ticket sidebar — raise a new ticket, select an existing one, each row
      showing its priority and current status
    - chat thread
    - ticket status panel — where this ticket stands, plus escalate to admin

Admin dashboard
    - Social-grievance queue under which put Twitter
    - Case detail
    - Agent activity panel

Keep the layout minimal. Do not wrap this content in cards.

## Ticket Status Panel

Replaces the agent activity panel on the customer side. Tool names, parameters,
and execution detail are CSR-facing — the customer sees plain language only.

Stored status values stay as they are (`open`, `in_progress`, `escalated`,
`resolved`) so they keep mirroring `service_request.status`. Only the labels
are customer-facing:

| Stored | Shown |
| --- | --- |
| `open` | Raised |
| `in_progress` | In progress |
| `escalated` | Escalated |
| `resolved` | Resolved |

The panel shows, top to bottom:

- current status badge, priority badge, and the servicing area for the intent
- a vertical progress track: Raised → In progress → Escalated → Resolved.
  Reached steps carry their status colour; unreached steps are greyed.
  Reaching a later status implies the earlier ones, so the track is derived
  from the current status rather than stored per step.
- the escalation note, when the customer escalated: when they did it and why
- a pinned bottom action bar with a single **Escalate to admin** button,
  disabled once the ticket is escalated or resolved

### Timestamps

Only three timestamps exist on a ticket: `createdAt`, `updatedAt`, and
`escalatedAt`. So a step is stamped only when we genuinely know its time —
Raised from `createdAt`, Escalated from `escalatedAt`, and the *current* step
from `updatedAt`. A step that has been passed but has no stored time of its own
is marked reached and shows an em dash. Do not borrow a nearby timestamp to
fill the gap: that would assert a transition time the system never recorded.

### Guidance note

Above the escalate button, a short note tells the customer which path to take:
the three supported request types are handled by the agent in the chat, and
escalation is for urgent cases or ones the agent could not resolve.

It renders only while escalation is available. Once the ticket is escalated or
resolved, that slot carries the state caption instead ("An admin is reviewing
this ticket." / "This ticket is resolved.") — showing both at once would give
contradictory advice.

Name the three request types in plain language, not by their intent labels.
The intent label already appears higher in the panel for the selected ticket.

## Escalate to Admin

The escalate button opens a dialog asking why the ticket needs a human. The
confirm action is blocked on an empty reason. On confirm the ticket moves to
`escalated`, stamps `escalatedAt`, stores the reason, and an agent message
lands in the thread confirming a specialist will take over.

State lives in the page component and is seeded from the mock fixtures. No API
call and no persistence in this unit.
