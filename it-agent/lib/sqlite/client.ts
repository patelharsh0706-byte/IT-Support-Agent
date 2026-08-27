import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

// Same libSQL client for local dev (a `file:` URL) and production (a
// `libsql:`/`https:` Turso URL) — one code path, per
// `context/architecture.md`'s storage model.
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db"
const authToken = process.env.TURSO_AUTH_TOKEN

declare global {
  var _libsqlClient: ReturnType<typeof createClient> | undefined
}

// Cache the *connection* on `global` in development so hot reloads don't
// open a new one on every module re-evaluation.
const client =
  global._libsqlClient ?? createClient(authToken ? { url, authToken } : { url })

if (process.env.NODE_ENV !== "production") {
  global._libsqlClient = client
}

// The Drizzle instance is deliberately NOT cached: `drizzle()` snapshots
// `schema` at construction, and the relational query API (`db.query.*`)
// builds its column lists from that snapshot. A cached instance therefore
// kept serving a pre-migration schema for the rest of the dev session —
// `db.query.*` reads silently dropped newly added columns, while
// `db.select()` and writes kept working because they take the imported
// table object, which HMR does refresh. That split is exactly how
// `escalation_reason` reached the database and the CSR console but never
// the customer dashboard. Rebuilding it per module evaluation is cheap;
// the connection above is the part worth reusing.
export const db = drizzle(client, { schema })
