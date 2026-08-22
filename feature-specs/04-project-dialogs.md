# Project Dialogs & Editor Home

## Goal

Build the dashboard for both customer and admin dashboard. No API calls or persistence yet.

## Dashboard Home

Reuse the existing editor layout. Do not modify the navbar or sidebar behavior.

Customer dashboard
    - ticket sidebar
    - chat thread

Admin dashboard
    - Social-grievance queue under which put Twitter
    - Case detail
    - Agent activity panel

Keep the layout minimal. Do not wrap this content in cards.



## Dialogs

### Create Project

- project name input
- live slug preview based on the name
- preview updates as the user types

### Rename Project

- prefilled project name input
- current project name shown in the description
- input auto-focuses
- Enter submits

### Delete Project

- destructive confirmation only
- no input
- confirm button uses destructive styling

## Sidebar

Add project item actions:

- rename
- delete

Show actions only for owned projects.

Hide actions for shared/collaborator projects.

On mobile:

- tapping outside the sidebar closes it
- add a backdrop scrim

## Implementation

Create a dedicated hook to manage:

- dialog state
- form state
- loading state

Wire:

- editor home `New Project` → Create dialog
- sidebar create → Create dialog
- sidebar rename → Rename dialog
- sidebar delete → Delete dialog

Use mock project data only. Do not add API calls or persistence.

## Check When Done

- sidebar actions are wired
- slug preview works
- no TypeScript errors
- no lint errors