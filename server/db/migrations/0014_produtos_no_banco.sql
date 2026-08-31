CREATE TABLE "payment_products" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_products_ref_idx" ON "payment_products" ("kind","ref_id");
