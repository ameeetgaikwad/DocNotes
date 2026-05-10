-- Clerk auth migration: switch users.id PK from uuid to text (Clerk user_id),
-- drop the homemade sessions table, change every userId FK column to text.
-- Owner (Amit) approved wiping all existing user/patient data for this migration.
--
-- This is destructive. Do NOT run against the shared Neon DB without explicit
-- terminal authorization from the project owner (per CLAUDE.md DB rules).

DROP TABLE IF EXISTS "audit_logs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "share_links" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "appointments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "medical_records" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "patients" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;--> statement-breakpoint

CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" varchar(20) DEFAULT 'gp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" varchar(20) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(20),
	"blood_type" varchar(5),
	"allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" jsonb,
	"vitals" jsonb,
	"diagnoses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_id" uuid,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 15 NOT NULL,
	"reason" varchar(500),
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"medical_record_id" uuid,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"s3_key" varchar(1024) NOT NULL,
	"status" varchar(20) DEFAULT 'uploading' NOT NULL,
	"notes" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"password_hash" varchar(255),
	"access_count" integer DEFAULT 0 NOT NULL,
	"max_accesses" integer,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" varchar(30) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"resource_id" uuid,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_medical_record_id_medical_records_id_fk" FOREIGN KEY ("medical_record_id") REFERENCES "public"."medical_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "patients_dob_idx" ON "patients" USING btree ("date_of_birth");--> statement-breakpoint
CREATE INDEX "patients_created_by_idx" ON "patients" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "medical_records_patient_idx" ON "medical_records" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "medical_records_type_idx" ON "medical_records" USING btree ("type");--> statement-breakpoint
CREATE INDEX "medical_records_created_by_idx" ON "medical_records" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "medical_records_parent_idx" ON "medical_records" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "medical_records_created_at_idx" ON "medical_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointments_provider_idx" ON "appointments" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "appointments_scheduled_idx" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_patient_idx" ON "documents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "documents_medical_record_idx" ON "documents" USING btree ("medical_record_id");--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "documents_s3_key_idx" ON "documents" USING btree ("s3_key");--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "share_links_resource_idx" ON "share_links" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "share_links_expires_at_idx" ON "share_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
