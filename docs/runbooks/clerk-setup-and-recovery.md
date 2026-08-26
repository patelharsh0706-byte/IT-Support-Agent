# Runbook — Clerk Instance Setup & Recovery

**Last verified:** 2026-08-25

Covers two failures that cost real time on 2026-08-25:

1. The Clerk instance was deleted server-side — every auth call returned
   `404 Resource not found`.
2. After recreating it, **CSR sign-in silently landed on the customer
   dashboard**, because a fresh instance comes up with none of the config
   the role gating depends on.

The second is the dangerous one. It produces **no error anywhere** — not in
the browser, not in the server log, not in the build. A CSR is just quietly
treated as a customer.

---

## 1. Required instance state

A Clerk instance is only correctly configured for this app when **both** of
these are true. Neither is a default. Neither survives recreating the app.

### 1a. Session token must carry `metadata`

`sessionClaims.metadata` is **NOT populated by default.** It must be mapped
explicitly, or it is `undefined` no matter what you set on the user.

```bash
clerk config patch --json '{"session":{"claims":{"metadata":"{{user.public_metadata}}"}}}'
```

Verify (`session` must not be `null`):

```bash
clerk config pull | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get('session'), indent=2))"
```

Expected:

```json
{ "allowed_clock_skew": 5, "claims": { "metadata": "{{user.public_metadata}}" }, "lifetime": 60 }
```

### 1b. The CSR user must carry the role

```bash
clerk api -X PATCH "/users/<USER_ID>/metadata" -d '{"public_metadata":{"role":"csr"}}' --yes
```

Verify all users and their roles:

```bash
clerk users list --json | python3 -c "
import json,sys
for u in json.load(sys.stdin)['data']:
    print(f\"  {u['email_addresses'][0]['email_address']:32} role={u.get('public_metadata',{}).get('role','(none - customer)')}\")
"
```

> **Order matters conceptually, not mechanically.** Setting 1b without 1a
> looks like it worked — the API returns `{"role": "csr"}` — but sign-in
> still lands on the customer dashboard. If you only remember one thing from
> this runbook, remember that 1a exists.

---

## 2. Why a missing claim is invisible

The role is read in exactly two places, and both **fail soft to
`"customer"`**:

- `lib/auth/session.ts` → `getRole()` returns `"customer"` for anything that
  isn't the literal string `"csr"`
- `proxy.ts` → same inline read, gating `/admin/*`

So a missing claim is indistinguishable from "this person is a customer."
`app/admin/page.tsx` then correctly offers the customer dashboard, and
nothing anywhere reports a problem.

That soft fallback is the right security posture — defaulting to the *lower*
privilege on missing data is correct, and it should stay. It just means
misconfiguration is silent by design, which is why it needs a runbook rather
than a fix.

---

## 3. Diagnosing "is the instance actually gone?"

Clerk returns `404 Resource not found` for a **valid key pointing at a
deleted instance**, and `401` for a malformed or unknown key. Run all three
— the controls are what make the result conclusive:

```bash
SK=$(grep '^CLERK_SECRET_KEY' .env.local | cut -d= -f2- | tr -d '"'"'"' ')
curl -s -o /dev/null -w "real key: %{http_code}\n" -H "Authorization: Bearer $SK" "https://api.clerk.com/v1/users?limit=1"
curl -s -o /dev/null -w "bogus key: %{http_code}\n" -H "Authorization: Bearer sk_test_totallyBogusKeyValue123456789" "https://api.clerk.com/v1/users?limit=1"
curl -s -o /dev/null -w "no key:    %{http_code}\n" "https://api.clerk.com/v1/users?limit=1"
```

| Real key | Bogus / none | Meaning |
| --- | --- | --- |
| `200` | `401` | Healthy |
| **`404`** | `401` | **Key is authentic, instance is deleted** |
| `401` | `401` | Key is malformed or from another account |

Also check the frontend API — this is the call clerk-js makes first, and the
one that surfaces as `_baseFetch` in the browser console:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<your-subdomain>.clerk.accounts.dev/v1/environment?__clerk_api_version=2025-04-10&_clerk_js_version=6.30.1"
```

### Do not trust `clerk doctor` or `clerk whoami` here

Both read a local cache at `~/Library/Preferences/clerk-cli/config.json`
that is **only written on link**. During the 2026-08-25 outage `doctor`
cheerfully reported the app *"is reachable"* while the live API returned 404
and `clerk apps list` returned `[]`.

`clerk apps list` hits the platform API live — trust that one.

---

## 4. Full recovery — recreating a deleted instance

```bash
cd it-agent

# 1. Create the app
clerk apps create "Amex Customer Service" --json

# 2. Relink the CLI (it stays pointed at the OLD app until you do this)
clerk link --app <NEW_APP_ID>

# 3. Pull keys to a TEMP file — never straight over .env.local,
#    which holds custom NEXT_PUBLIC_CLERK_*_URL vars that pull does not preserve
clerk env pull --app <NEW_APP_ID> --file .env.clerk.tmp

# 4. Merge ONLY the two key lines into .env.local, then remove the temp file

# 5. Apply the session claim mapping — see 1a. DO NOT SKIP.
clerk config patch --json '{"session":{"claims":{"metadata":"{{user.public_metadata}}"}}}'

# 6. Sign up through the app, then grant csr — see 1b

# 7. Restart the dev server; the running one holds dead keys in memory
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Post-recovery checklist

- [ ] `clerk config pull` shows `session.claims.metadata`
- [ ] `clerk users list` shows the CSR user with `role=csr`
- [ ] `.env.local` still has all four `NEXT_PUBLIC_CLERK_*_URL` vars
- [ ] Dev server restarted (env is read at boot)
- [ ] **Signed out and back in** — an existing browser session holds a token
      minted before the claim existed
- [ ] `/admin` redirects a CSR to `/admin/conversations`
- [ ] Re-seed `customers.clerk_user_id` — old values point at users from the
      deleted instance and are now dangling
- [ ] Confirm enabled sign-in methods match the demo script (a new instance
      may only have Google OAuth)

---

## 5. Route behaviour reference (signed out)

Use this to tell "auth is broken" from "auth is working correctly":

```
/                     -> 307    redirect to sign-in
/customer/sign-in     -> 200
/sign-up              -> 200
/admin                -> 307
/admin/sign-in        -> 200
/admin/conversations  -> 307
/api/service-requests -> 401    NOT a 307 — see proxy.ts
```

A `307` on an API route means the API branch in `proxy.ts` regressed: fetch
clients can't follow a redirect to an HTML sign-in page, so each route's own
401 handling becomes unreachable.

---

## 6. Current instance (2026-08-25)

| | |
| --- | --- |
| App | `Amex Customer Service` — `app_3IORCCnSXSizaOSAgFRpTftJXct` |
| Dev instance | `ins_3IORCCBXVcHhD1du78kTrGTzAQo` |
| Frontend API | `boss-snipe-1592.clerk.accounts.dev` |
| CSR | patelharsh0706@gmail.com — `user_3IORpKzakgqyan0I9fEfzE8mMt1` |
| Customer | killer.master502@gmail.com — `user_3IORhhIcJun7tJB6G567AXiJ5Vm` |

Superseded: `careful-grub-1107` / `app_3IGbdc5pSUETxiFKOXTmfH8gIzD` (deleted
server-side; cause never determined — it was live at ~01:35 and 404ing by
~12:38 on 2026-08-25, with no traffic in between to narrow it).

Keys live in `it-agent/.env.local` (gitignored). Names only are documented in
`.env.example`.
