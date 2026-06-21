ALTER TABLE "recommendations" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendations_customer_type_status_idx" ON "recommendations" USING btree ("customer_id","type","status");