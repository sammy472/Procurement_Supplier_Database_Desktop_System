DO $$ BEGIN
  CREATE TYPE "public"."tender_status" AS ENUM('draft', 'active', 'closed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tender_task_status" AS ENUM('pending', 'submitted', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE "material_request_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notification_read_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_log_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"deadline" timestamp NOT NULL,
	"status" "tender_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "currency" varchar(3) DEFAULT 'GHC' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "nhil_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "getfund_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "covid_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "delivery_terms" text;--> statement-breakpoint
ALTER TABLE "material_request_documents" ADD CONSTRAINT "material_request_documents_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_documents" ADD CONSTRAINT "material_request_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_read_status" ADD CONSTRAINT "notification_read_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_read_status" ADD CONSTRAINT "notification_read_status_activity_log_id_activity_logs_id_fk" FOREIGN KEY ("activity_log_id") REFERENCES "public"."activity_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tasks" ADD CONSTRAINT "tender_tasks_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tasks" ADD CONSTRAINT "tender_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" DROP COLUMN "discount";
