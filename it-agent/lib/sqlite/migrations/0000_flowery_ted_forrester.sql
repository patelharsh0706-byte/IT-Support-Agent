CREATE TABLE `agent_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`service_request_id` text,
	`chat_message_id` text,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`detail` text,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`last_four` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_session_id` text NOT NULL,
	`author_role` text NOT NULL,
	`author_name` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`chat_session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`service_request_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_request` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`channel` text NOT NULL,
	`intent` text NOT NULL,
	`title` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`current_severity` text NOT NULL,
	`customer_verified` integer DEFAULT false NOT NULL,
	`escalated_at` text,
	`contacted_by_csr_name` text,
	`reply_state` text NOT NULL,
	`original_post_url` text,
	`classification_intent` text,
	`classification_confidence` real,
	`ai_draft_reply` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `severity_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`service_request_id` text NOT NULL,
	`from_severity` text,
	`to_severity` text NOT NULL,
	`changed_at` text NOT NULL,
	`reason` text,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`service_request_id` text NOT NULL,
	`permalink` text NOT NULL,
	`excerpt` text NOT NULL,
	`posted_at` text NOT NULL,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE cascade
);
