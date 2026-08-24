import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

// Same libSQL client for local dev (a `file:` URL) and production (a
// `libsql:`/`https:` Turso URL) — one code path, per
// `context/architecture.md`'s storage model.
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db"
const authToken = process.env.TURSO_AUTH_TOKEN

const client = createClient(
  authToken ? { url, authToken } : { url },
)

declare global {
  var _dbClient: ReturnType<typeof drizzle<typeof schema>> | undefined
}

// Cache on `global` in development so hot reloads don't open a new
// connection on every module re-evaluation.
export const db =
  global._dbClient ?? drizzle(client, { schema })

if (process.env.NODE_ENV !== "production") {
  global._dbClient = db
}
