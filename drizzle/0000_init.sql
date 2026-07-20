CREATE TABLE `item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_file` text NOT NULL,
	`category` text NOT NULL,
	`name` text,
	`brand` text,
	`season` text,
	`source_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outfit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`occasion` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outfit_item` (
	`outfit_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	PRIMARY KEY(`outfit_id`, `item_id`),
	FOREIGN KEY (`outfit_id`) REFERENCES `outfit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wear_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`outfit_id` integer NOT NULL,
	`worn_on` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`outfit_id`) REFERENCES `outfit`(`id`) ON UPDATE no action ON DELETE cascade
);
