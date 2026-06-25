CREATE INDEX "bookings_lead_idx" ON "bookings" USING btree ("lead_id") WHERE lead_id is not null;--> statement-breakpoint
CREATE INDEX "customers_created_id_idx" ON "customers" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "job_materials_created_idx" ON "job_materials" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_created_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "jobs_customer_created_idx" ON "jobs" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_customer_status_idx" ON "jobs" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "jobs_created_id_idx" ON "jobs" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "jobs_booking_idx" ON "jobs" USING btree ("booking_id") WHERE booking_id is not null;--> statement-breakpoint
CREATE INDEX "leads_status_created_idx" ON "leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "leads_customer_created_idx" ON "leads" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_created_id_idx" ON "leads" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "payments_customer_created_idx" ON "payments" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_customer_status_idx" ON "payments" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "quotes_customer_created_idx" ON "quotes" USING btree ("customer_id","created_at");--> statement-breakpoint
-- Expression index for the reports revenue predicate: revenue is recognized on
-- coalesce(completed_at, updated_at, created_at), which a plain column index
-- can't serve. This matches the exact expression used in lib/reports.ts.
CREATE INDEX "jobs_revenue_at_idx" ON "jobs" USING btree ("status", (coalesce("completed_at", "updated_at", "created_at")));--> statement-breakpoint
-- Trigram indexes so customer/material search can use ILIKE '%q%' at scale
-- instead of a sequential scan + JS filter.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "customers_name_trgm_idx" ON "customers" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_phone_trgm_idx" ON "customers" USING gin ("phone" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "job_materials_name_trgm_idx" ON "job_materials" USING gin ("name" gin_trgm_ops);