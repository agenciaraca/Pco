CREATE TABLE "payment_coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"discount" jsonb NOT NULL,
	"applies_to_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" text,
	"valid_until" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "payment_coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "question_bank" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"module_id" text,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_answer" text,
	"explanation" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"difficulty" integer DEFAULT 3 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
