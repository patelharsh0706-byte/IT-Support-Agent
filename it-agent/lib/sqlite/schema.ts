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
  // The customer's own words when they escalate — surfaced to the CSR in
  // `conversation-context-sidebar.tsx` and as a chat message (see
  // `escalateServiceRequest` in `queries.ts`). Distinct from
  // `severity_changes.reason`, which is generic to any severity change.
  escalationReason: text("escalation_reason"),
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

// A raw brand mention is NOT a case, so it does not live in `social_posts` —
// that table's `service_request_id` is `notNull` by design and records posts
// attached to a case that already exists. See `feature-specs/09-tweet-fetch-agent.md`.
export const tweetMentions = sqliteTable(
  "tweet_mentions",
  {
    id: text("id").primaryKey(),
    // The platform's own id. Unique, and the entire dedupe story for this
    // unit: fetching twice over the same window inserts nothing the second
    // time. Author-plus-issue dedupe into cases is S3, not here.
    tweetId: text("tweet_id").notNull(),
    // Display only. A handle is never authentication — invariant 4.
    authorHandle: text("author_handle").notNull(),
    authorName: text("author_name").notNull(),
    text: text("text").notNull(),
    // The tweet's own timestamp, not ingest time — the 6/12/24h windows and
    // the aged-grievance rule both key off this.
    postedAt: text("posted_at").notNull(),
    permalink: text("permalink").notNull(),
    // Reach signals; feed the urgency score.
    replyCount: integer("reply_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    fetchedAt: text("fetched_at").notNull(),
    isGrievance: integer("is_grievance", { mode: "boolean" })
      .notNull()
      .default(false),
    urgency: text("urgency", { enum: ["critical", "high", "normal"] })
      .notNull()
      .default("normal"),
    // JSON array of human-readable strings — *why* this urgency, for display.
    // An admin who cannot see why a tweet is critical stops trusting the mark.
    urgencyReasons: text("urgency_reasons").notNull().default("[]"),
    // Nullable and unused in this unit: promoting a mention into a case is
    // out of scope (S4). The column exists so the route can land later
    // without a migration.
    serviceRequestId: text("service_request_id").references(
      () => serviceRequests.id,
      { onDelete: "set null" },
    ),
    dismissedAt: text("dismissed_at"),
  },
  (table) => [uniqueIndex("tweet_mentions_tweet_id_unique").on(table.tweetId)],
)

// One row per outbound attempt, never overwritten. A `failed` row stays: an
// admin needs to see that a send was attempted and did not land, because
// silently discarding it is how a customer ends up believing they were
// answered when they were not.
export const tweetReplies = sqliteTable("tweet_replies", {
  id: text("id").primaryKey(),
  tweetMentionId: text("tweet_mention_id")
    .notNull()
    .references(() => tweetMentions.id, { onDelete: "cascade" }),
  // Exactly what was sent.
  text: text("text").notNull(),
  // Resolved server-side from the session, never from the request body —
  // the rule `08-persisted-messages.md` established for chat messages.
  sentByCsrName: text("sent_by_csr_name").notNull(),
  status: text("status", { enum: ["pending", "sent", "failed"] }).notNull(),
  platformReplyId: text("platform_reply_id"),
  platformPermalink: text("platform_permalink"),
  // The platform's message, on `failed`.
  error: text("error"),
  // True when this went through the dry-run path and reached no timeline.
  isDryRun: integer("is_dry_run", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
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
  // "csr" added alongside the pre-existing "agent" (reserved for the future
  // AI agent pipeline, `lib/agent/`, not built yet) so a human CSR reply is
  // distinguishable from an eventual bot-authored one.
  authorRole: text("author_role", {
    enum: ["customer", "agent", "csr"],
  }).notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  // CSR-only, never sent to a customer session (see `messages/route.ts`'s
  // GET handler, which strips these before returning to a customer).
  isPrivateNote: integer("is_private_note", { mode: "boolean" })
    .notNull()
    .default(false),
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
  // Third nullable subject, alongside the two above: a tweet fetch or a
  // public reply belongs to neither a service request nor a chat message,
  // and without this the audit row would be orphaned — unable to answer
  // "who posted this publicly, and when" (R17).
  tweetMentionId: text("tweet_mention_id").references(() => tweetMentions.id, {
    onDelete: "cascade",
  }),
  stage: text("stage").notNull(),
  status: text("status", {
    enum: ["running", "ok", "failed", "denied"],
  }).notNull(),
  detail: text("detail"),
  timestamp: text("timestamp").notNull(),
})
