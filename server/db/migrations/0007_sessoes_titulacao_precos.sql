CREATE TABLE "session_price_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "level" text DEFAULT 'escola' NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "credentials" text DEFAULT '' NOT NULL;