CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`card_id` text NOT NULL,
	`merchant` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`posted_at` text NOT NULL,
	`status` text DEFAULT 'posted' NOT NULL,
	`disputed_at` text,
	`dispute_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `service_request` ADD `issue` text;