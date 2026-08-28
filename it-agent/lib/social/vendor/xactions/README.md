# Vendored from XActions

Ported code, not a dependency.

| | |
|---|---|
| **Upstream** | https://github.com/nirholas/XActions |
| **Version** | `3.5.0` (npm), commit `196de44839d2` |
| **Licence** | Apache License 2.0 — full text in `./LICENSE` |
| **Copyright** | © 2024–2026 nich (@nichxbt) |

## Why ported rather than installed

`xactions@3.5.0` declares **35 direct dependencies**, including Prisma, Express,
Puppeteer, `node-cron`, `bull`, `redis` and Stripe. Installing it would put a
second ORM, a second HTTP server and a scheduler inside this Next.js app, which
`context/architecture.md` invariants 6 and 7 forbid. We need two of its
functions, so we ported those.

## What each file derives from

| this file | upstream source |
|---|---|
| `client.ts` | `src/scrapers/twitter/http/client.js` (`TwitterHttpClient`, `_buildHeaders`, `graphql`, `_graphqlOnce`) |
| `endpoints.ts` | `src/scrapers/twitter/http/endpoints.js` (`BEARER_TOKEN`, `GRAPHQL_BASE`, `DEFAULT_FEATURES`, `buildGraphQLUrl`) and `queryIds.js` (`SearchTimeline`, `CreateTweet` ids) |
| `search.ts` | `src/scrapers/twitter/http/search.js` (`searchTweets`) |
| `reply.ts` | `src/scrapers/twitter/http/actions.js` (`postTweet`, `replyToTweet`, `parseTweetResult`) |
| `parsers.ts` | `src/scrapers/twitter/http/tweets.js` and `profile.js` (timeline entry → tweet/author) |
| `errors.ts` | `src/scrapers/twitter/http/errors.js` |

## Changes made

- **Ported from ESM JavaScript to TypeScript** and typed throughout; this
  project is `strict`.
- **Dropped every write path except replying.** Upstream `actions.js` also
  exports `postTweet`, `postThread`, `deleteTweet`, `quoteTweet` and
  `schedulePost`. Note that upstream's `replyToTweet` is a thin wrapper around
  `postTweet`, so the `CreateTweet` mutation is necessarily still here — but
  `reply.ts` exports exactly one function, and it always sets
  `reply.in_reply_to_tweet_id`. **There is no exported path that posts a
  standalone tweet, quotes, deletes, or schedules**, which is what invariant 5
  requires of this codebase.
- **Dropped every read path except search.** No `searchUsers`, `scrapeTrending`,
  `scrapeHashtag`, timelines, followers, DMs, bookmarks or media.
- **Dropped the live query-id auto-refresh.** Upstream re-scrapes x.com's JS
  bundles to self-heal stale GraphQL ids. That is a background network call we
  do not want in a request path, so ids are pinned here and a stale id surfaces
  as a loud error instead.
- **Dropped Puppeteer/Playwright session acquisition**, the account pool, and
  the checkpoint/resume machinery. Cookies come from `.env.local`.
- Rate limiting reduced to a fixed inter-page delay and a page cap.

## Note on a licence inconsistency upstream

`src/scrapers/twitter/http/actions.js` carries an Apache-2.0 copyright line but
a `@license MIT` JSDoc tag. The repository's `LICENSE` file and its
`package.json` both declare Apache-2.0, so that is what we have honoured here.

## Known broken: the SearchTimeline query id is stale (2026-08-28)

The live path does not work as shipped. `SearchTimeline` is pinned to
`hyPfJYJ_XAtDYoslQc-Rgg` (upstream's value, dated 2026-08-27) and X has since
rotated it; the endpoint returns **404**. Fetching a fresh id and updating
`endpoints.ts` is the whole fix.

**Everything else was verified working** against a real logged-in session, by
replaying a browser's own request and removing one variable at a time:

| tested | result |
|---|---|
| the pinned bearer token | current — byte-identical to the browser's |
| two cookies only (`auth_token`, `ct0`) | **200** — the extra ~15 browser cookies are not needed |
| no `x-client-transaction-id` | **200** — the header is not required |
| our exact header shape | **200** |
| `SearchTimeline` with the pinned id | **404** |

So do not re-debug auth, cookies, headers or the bearer. It is the id.

Two traps that cost real time here, recorded so they do not cost it twice:

- **`/i/api/1.1/account/settings.json` and `guest/activate.json` both 404 now** —
  they are retired, not rejecting you. They are useless as auth checks and
  actively misleading: a 404 there looks exactly like a credential failure.
- **X returns 404, not 401/403, for a bad query id.** Wrong-id and
  no-such-endpoint are indistinguishable by status code.

To get a current id: on x.com, run a search, then in the DevTools **Console**
run `performance.getEntriesByType('resource').map(e=>e.name)
.find(n=>n.includes('SearchTimeline'))`. The id is the path segment before
`/SearchTimeline`. `CreateTweet` rotates the same way and will need the same
treatment before the reply path can publish live.

Because these rotate on X's schedule, consider moving both ids to environment
variables so a rotation is a config change rather than a code change.

## Warning

These endpoints are X's internal GraphQL API, not a supported public API. They
can change without notice, and using them is outside X's terms of service. See
the risks section of `feature-specs/09-tweet-fetch-agent.md`.
