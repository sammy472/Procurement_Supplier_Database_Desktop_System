CREATE TYPE "public"."tender_status" AS ENUM('draft', 'active', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tender_task_status" AS ENUM('pending', 'submitted', 'deleted');--> statement-breakpoint

CREATE TABLE "tenders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "deadline" timestamp NOT NULL,
  "status" "tender_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "tender_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tender_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "assignee_id" uuid NOT NULL,
  "status" "tender_task_status" DEFAULT 'pending' NOT NULL,
  "file_name" varchar(255),
  "file_path" varchar(500),
  "file_type" varchar(100),
  "submitted_at" timestamp,
  "deleted_at" timestamp,
  "due_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tasks" ADD CONSTRAINT "tender_tasks_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tasks" ADD CONSTRAINT "tender_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "tender_tasks_tender_id_idx" ON "tender_tasks" ("tender_id");--> statement-breakpoint
CREATE INDEX "tender_tasks_assignee_id_idx" ON "tender_tasks" ("assignee_id");--> statement-breakpoint
CREATE INDEX "tender_tasks_status_idx" ON "tender_tasks" ("status");

