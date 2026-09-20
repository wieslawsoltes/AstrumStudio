CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`author` text NOT NULL,
	`text` text NOT NULL,
	`object_id` text,
	`frame` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_project_created` ON `comments` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `members_project` ON `members` (`project_id`);--> statement-breakpoint
CREATE INDEX `members_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `presence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`selection` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `presence_project` ON `presence` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`scene` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner` ON `projects` (`owner`);