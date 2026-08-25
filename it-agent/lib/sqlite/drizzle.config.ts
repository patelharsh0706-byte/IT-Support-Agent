import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/sqlite/schema.ts",
  out: "./lib/sqlite/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  },
})
