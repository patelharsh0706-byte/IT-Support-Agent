Clerk is already installed and connected. Wire it into the Next.js app: provider, auth pages, redirects, route protection, and user menu.

## Design

Use Clerk’s `dark` theme from `@clerk/ui/themes` as the base.

Override Clerk appearance variables using the app’s existing CSS variables. Do not hardcode colors.

Sign-in and sign-up pages:

- large screens: simple two-panel layout
- left: compact logo, tagline, short text-only feature list
- right: centered Clerk form
- small screens: form only
- no gradients
- no oversized hero sections
- no feature cards
- no scroll-heavy layouts

Keep the layout minimal and professional.

## Implementation

Wrap the root layout with `ClerkProvider` using Clerk’s `dark` theme.

Create sign-in and sign-up pages using Clerk components.

Use `proxy.ts` at the project root, not `middleware.ts`.

Define public routes using the existing sign-in and sign-up env vars. Protect everything else by default.

Update `/`:

- authenticated users redirect to `/editor`
- unauthenticated users redirect to `/sign-in`

Add Clerk’s built-in `UserButton` to the editor navbar right section for profile settings and logout.

Keep Clerk’s default user menu and profile flows intact. Do not rebuild or heavily customize Clerk internals.

Use existing Clerk env vars. Do not rename or invent new ones.

## Dependencies

install: @clerk/ui.

## Check When Done

- `proxy.ts` exists at the root
- all routes are protected except public auth paths
- auth pages use CSS variables with no hardcoded colors
- `ClerkProvider` wraps the root layout
- `npm run build` passes

---

## Addendum: two doors (2026-08-22)

The app keeps the `customer`/`csr` role split from the original auth design
(see git history / progress-tracker), so there are **two sign-in doors**,
not one:

- `/sign-in` — customer door. Self-serve: links to `/sign-up`.
- `/admin/sign-in` — CSR door. **Invite-only**: no sign-up affordance.
  CSR accounts are provisioned out-of-band (Clerk Dashboard or
  `clerk users create`) with `publicMetadata.role = "csr"` set explicitly —
  there is no path from `/admin/sign-in` to account creation.

Both doors render the same Clerk `<SignIn />` against the same Clerk
instance and produce the same session shape — the door is presentation
only (badge + copy, via `AuthSplitLayout`'s `badge`/`footnote` props) and
is never an authorization signal. `proxy.ts` still authorizes `/admin/*`
from `sessionClaims.metadata.role` alone; the CSR door existing does not
mean visiting it grants the role. Each door links to the other beneath the
form so someone at the wrong entrance is one click away from the right one.

`proxy.ts`'s public-route matcher includes `/admin/sign-in(.*)` alongside
`/sign-in(.*)` and `/sign-up(.*)`; an unauthenticated request to any other
`/admin/*` route redirects to `/admin/sign-in` specifically, not the
generic `/sign-in`.