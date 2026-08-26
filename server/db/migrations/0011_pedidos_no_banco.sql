CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text DEFAULT '' NOT NULL,
	"product_id" text NOT NULL,
	"product_snapshot" jsonb NOT NULL,
	"gateway_id" text NOT NULL,
	"gateway_provider" text NOT NULL,
	"external_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checkout_url" text,
	"qr_code" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"paid_at" text
);
