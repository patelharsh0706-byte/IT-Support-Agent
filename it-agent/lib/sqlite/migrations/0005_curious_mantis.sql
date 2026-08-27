CREATE TABLE `tweet_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`tweet_id` text NOT NULL,
	`author_handle` text NOT NULL,
	`author_name` text NOT NULL,
	`text` text NOT NULL,
	`posted_at` text NOT NULL,
	`permalink` text NOT NULL,
	`reply_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`fetched_at` text NOT NULL,
	`is_grievance` integer DEFAULT false NOT NULL,
	`urgency` text DEFAULT 'normal' NOT NULL,
	`urgency_reasons` text DEFAULT '[]' NOT NULL,
	`service_request_id` text,
	`dismissed_at` text,
	FOREIGN KEY (`service_request_id`) REFERENCES `service_request`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tweet_mentions_tweet_id_unique` ON `tweet_mentions` (`tweet_id`);--> statement-breakpoint
CREATE TABLE `tweet_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`tweet_mention_id` text NOT NULL,
	`text` text NOT NULL,
	`sent_by_csr_name` text NOT NULL,
	`status` text NOT NULL,
	`platform_reply_id` text,
	`platform_permalink` text,
	`error` text,
	`is_dry_run` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`tweet_mention_id`) REFERENCES `tweet_mentions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `agent_actions` ADD `tweet_mention_id` text REFERENCES tweet_mentions(id);