ALTER TABLE "external_data_sources" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "external_data_sources" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "external_data_sources" ADD COLUMN "last_error_at" timestamp;--> statement-breakpoint
ALTER TABLE "external_data_sources" ADD COLUMN "auth_config" jsonb;