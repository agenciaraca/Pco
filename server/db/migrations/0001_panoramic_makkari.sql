ALTER TYPE "public"."ai_module" ADD VALUE 'grading';--> statement-breakpoint
ALTER TABLE "library_items" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "podcasts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;