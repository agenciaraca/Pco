CREATE TABLE IF NOT EXISTS "analytics_daily" (
	"date" text PRIMARY KEY NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"bounces" integer DEFAULT 0 NOT NULL,
	"total_session_seconds" integer DEFAULT 0 NOT NULL,
	"by_path" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_device" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lcp_buckets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lcp_count" integer DEFAULT 0 NOT NULL,
	"not_found" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" text NOT NULL
);
