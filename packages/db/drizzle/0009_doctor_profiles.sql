CREATE TABLE "doctor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"date_of_birth" date,
	"qualification" varchar(120) NOT NULL,
	"specialization" varchar(120),
	"clinic_name" varchar(200) NOT NULL,
	"taluka" varchar(120) NOT NULL,
	"district" varchar(120) NOT NULL,
	"state" varchar(120) NOT NULL,
	"mobile_number" varchar(32) NOT NULL,
	"email" varchar(254),
	"registration_number" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_profiles_user_id_uniq" ON "doctor_profiles" USING btree ("user_id");
