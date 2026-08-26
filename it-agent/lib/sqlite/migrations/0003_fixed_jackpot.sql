ALTER TABLE `chat_messages` ADD `is_private_note` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `service_request` ADD `escalation_reason` text;