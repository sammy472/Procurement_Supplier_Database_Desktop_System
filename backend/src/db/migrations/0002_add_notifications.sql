-- Migration: Add notification read status tracking
CREATE TABLE IF NOT EXISTS "notification_read_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_log_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_read_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "notification_read_status_activity_log_id_activity_logs_id_fk" FOREIGN KEY ("activity_log_id") REFERENCES "activity_logs"("id") ON DELETE cascade ON UPDATE no action
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "notification_read_status_user_id_idx" ON "notification_read_status" ("user_id");
CREATE INDEX IF NOT EXISTS "notification_read_status_activity_log_id_idx" ON "notification_read_status" ("activity_log_id");
CREATE INDEX IF NOT EXISTS "notification_read_status_is_read_idx" ON "notification_read_status" ("is_read");

-- Create unique constraint to prevent duplicate read status entries
CREATE UNIQUE INDEX IF NOT EXISTS "notification_read_status_unique_idx" ON "notification_read_status" ("user_id", "activity_log_id");
