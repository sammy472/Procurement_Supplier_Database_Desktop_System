CREATE TYPE "public"."rfq_status" AS ENUM('active', 'sent', 'closed');--> statement-breakpoint

CREATE TABLE "rfqs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sender_address" text NOT NULL,
  "items" jsonb NOT NULL,
  "open_date" timestamp NOT NULL,
  "close_date" timestamp NOT NULL,
  "status" "rfq_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "rfq_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rfq_id" uuid NOT NULL,
  "assignee_id" uuid NOT NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_assignments" ADD CONSTRAINT "rfq_assignments_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_assignments" ADD CONSTRAINT "rfq_assignments_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "rfq_assignments_rfq_id_idx" ON "rfq_assignments" ("rfq_id");--> statement-breakpoint
CREATE INDEX "rfq_assignments_assignee_id_idx" ON "rfq_assignments" ("assignee_id");--> statement-breakpoint
