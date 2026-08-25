PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_service_request` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`channel` text NOT NULL,
	`intent` text,
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
INSERT INTO `__new_service_request`("id", "customer_id", "channel", "intent", "title", "priority", "status", "current_severity", "customer_verified", "escalated_at", "contacted_by_csr_name", "reply_state", "original_post_url", "classification_intent", "classification_confidence", "ai_draft_reply", "created_at", "updated_at") SELECT "id", "customer_id", "channel", "intent", "title", "priority", "status", "current_severity", "customer_verified", "escalated_at", "contacted_by_csr_name", "reply_state", "original_post_url", "classification_intent", "classification_confidence", "ai_draft_reply", "created_at", "updated_at" FROM `service_request`;--> statement-breakpoint
DROP TABLE `service_request`;--> statement-breakpoint
ALTER TABLE `__new_service_request` RENAME TO `service_request`;--> statement-breakpoint
PRAGMA foreign_keys=ON;