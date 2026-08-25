import { sql } from "drizzle-orm"
import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core"

// Field names and unions mirror `it-agent/lib/mock/types.ts` and the mapping
// in `feature-specs/05-sqlite.md` — swapping fixtures for these tables is a
// drop-in, not a rewrite.

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    status: text("status", { enum: ["active", "closed", "unknown"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    // Prevents two concurrent `resolveCustomer()` calls for the same Clerk
    // user from provisioning duplicate customer rows (SQLite treats
    // multiple NULLs as distinct, so seeded rows with no `clerk_user_id`
    // are unaffected).
    uniqueIndex("customers_clerk_user_id_unique").on(table.clerkUserId),
  ],
)

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  lastFour: text("last_four").notNull(),
  status: text("status", { enum: ["active", "frozen", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const serviceRequests = sqliteTable("service_request", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  channel: text("channel", {
    enum: ["amex_support", "social", "website_chatbot"],
  }).notNull(),
  // Nullable: a customer-created request exists before classification runs
  // (`lib/agent/classify.ts`, not built yet) — see `06-project-api.md`.
  intent: text("intent", {
    enum: [
      "card_unblock_activation",
      "unrecognized_transaction",
      "update_contact_info",
    ],
  }),
  title: text("title").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull(),
  status: text("status", {
    enum: ["open", "in_progress", "resolved", "escalated"],
  }).notNull(),
  currentSeverity: text("current_severity", {
    enum: ["low", "medium", "high"],
  }).notNull(),
  customerVerified: integer("customer_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  escalatedAt: text("escalated_at"),
  contactedByCsrName: text("contacted_by_csr_name"),
  replyState: text("reply_state", {
    enum: ["needs_reply", "draft_ready", "replied", "escalated"],
  }).notNull(),
  originalPostUrl: text("original_post_url"),
  classificationIntent: text("classification_intent"),
  classificationConfidence: real("classification_confidence"),
  aiDraftReply: text("ai_draft_reply"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const socialPosts = sqliteTable("social_posts", {
  id: text("id").primaryKey(),
  serviceRequestId: text("service_request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  permalink: text("permalink").notNull(),
  excerpt: text("excerpt").notNull(),
  postedAt: text("posted_at").notNull(),
})

export const severityChanges = sqliteTable("severity_changes", {
  id: text("id").primaryKey(),
  serviceRequestId: text("service_request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  fromSeverity: text("from_severity", { enum: ["low", "medium", "high"] }),
  toSeverity: text("to_severity", {
    enum: ["low", "medium", "high"],
  }).notNull(),
  changedAt: text("changed_at").notNull(),
  reason: text("reason"),
})

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  serviceRequestId: text("service_request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  chatSessionId: text("chat_session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  authorRole: text("author_role", { enum: ["customer", "agent"] }).notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
})

// Repacks `ActivityEvent` — shared by chat-message activity streams and
// grievance-case tool-call logs. Exactly one of `serviceRequestId` /
// `chatMessageId` is set per row.
export const agentActions = sqliteTable("agent_actions", {
  id: text("id").primaryKey(),
  serviceRequestId: text("service_request_id").references(
    () => serviceRequests.id,
    { onDelete: "cascade" },
  ),
  chatMessageId: text("chat_message_id").references(() => chatMessages.id, {
    onDelete: "cascade",
  }),
  stage: text("stage").notNull(),
  status: text("status", {
    enum: ["running", "ok", "failed", "denied"],
  }).notNull(),
  detail: text("detail"),
  timestamp: text("timestamp").notNull(),
})
