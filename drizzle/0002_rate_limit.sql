CREATE TABLE IF NOT EXISTS "rateLimit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" text NOT NULL,
	CONSTRAINT "rateLimit_key_unique" UNIQUE("key")
);
