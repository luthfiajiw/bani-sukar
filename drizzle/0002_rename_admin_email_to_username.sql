ALTER TABLE "admin_users" RENAME COLUMN "email" TO "username";--> statement-breakpoint
ALTER TABLE "admin_users" RENAME CONSTRAINT "admin_users_email_unique" TO "admin_users_username_unique";
