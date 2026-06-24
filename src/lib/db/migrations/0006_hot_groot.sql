CREATE TYPE "public"."material_purchaser" AS ENUM('company', 'client');--> statement-breakpoint
CREATE TABLE "job_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"purchaser" "material_purchaser" DEFAULT 'company' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_materials_job_idx" ON "job_materials" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_materials_name_idx" ON "job_materials" USING btree ("name");