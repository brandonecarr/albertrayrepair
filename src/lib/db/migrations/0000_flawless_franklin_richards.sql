CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('booking', 'contact');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "lead_type" NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"service" text,
	"preferred_date" text,
	"preferred_time" text,
	"address" text,
	"message" text,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");