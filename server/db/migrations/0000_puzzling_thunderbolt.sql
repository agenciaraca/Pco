CREATE TYPE "public"."ai_module" AS ENUM('tutor', 'recovery_plan', 'evasion', 'recommendations', 'support', 'summaries');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai', 'google', 'mistral', 'deepseek', 'groq');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('locked', 'available', 'in_progress', 'completed', 'pending_assessment');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'admin', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('ativo', 'em_risco', 'bloqueado', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."support_category" AS ENUM('duvida_aula', 'acesso', 'certificado', 'tutor', 'biblioteca', 'outro');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "ai_configurations" (
	"id" text PRIMARY KEY NOT NULL,
	"module" "ai_module" NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"api_key_encrypted" text DEFAULT '' NOT NULL,
	"temperature" double precision DEFAULT 0.3 NOT NULL,
	"max_tokens" integer DEFAULT 1200 NOT NULL,
	"per_student_limit" integer DEFAULT 50 NOT NULL,
	"per_day_limit" integer DEFAULT 5000 NOT NULL,
	"per_month_limit" integer DEFAULT 120000 NOT NULL,
	"monthly_cost_cap" double precision DEFAULT 800 NOT NULL,
	"system_message" text DEFAULT '' NOT NULL,
	"allowed_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fallback_response" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text NOT NULL,
	"student_id" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"successful" boolean DEFAULT true NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"question_count" integer DEFAULT 10 NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"student_id" text NOT NULL,
	"issued_at" timestamp with time zone,
	"validation_code" text NOT NULL,
	"qr_code_url" text DEFAULT '#' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "certificates_validation_code_unique" UNIQUE("validation_code")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_title" text NOT NULL,
	"description" text NOT NULL,
	"cover_color" text NOT NULL,
	"total_hours" integer DEFAULT 0 NOT NULL,
	"certificate_available" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"course_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"video_url" text,
	"description" text,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"type" text NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"file_url" text NOT NULL,
	"related_course_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_module_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"theme" text
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"release_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text,
	"category" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_color" text NOT NULL,
	"author_name" text NOT NULL,
	"published_at" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"related_course_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"published_at" text NOT NULL,
	"cover_color" text NOT NULL,
	"audio_url" text,
	"related_course_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_module_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatar_color" text NOT NULL,
	"bio" text NOT NULL,
	"email" text NOT NULL,
	"hourly_rate" integer DEFAULT 0 NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"service_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_risks" (
	"student_id" text PRIMARY KEY NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"level" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_progress" integer DEFAULT 0 NOT NULL,
	"real_progress" integer DEFAULT 0 NOT NULL,
	"pending_assessments" integer DEFAULT 0 NOT NULL,
	"tutor_usage" integer DEFAULT 0 NOT NULL,
	"pod_consumption" integer DEFAULT 0 NOT NULL,
	"library_interactions" integer DEFAULT 0 NOT NULL,
	"recommended_action" text DEFAULT '' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer DEFAULT 50 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"payment_before_confirmation" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"weekly_goal_minutes" integer DEFAULT 180 NOT NULL,
	"total_study_minutes" integer DEFAULT 0 NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"status" "student_status" DEFAULT 'ativo' NOT NULL,
	"last_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject" text NOT NULL,
	"category" "support_category" NOT NULL,
	"status" "support_status" DEFAULT 'open' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'student' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_config_id_ai_configurations_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."ai_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_risks" ADD CONSTRAINT "retention_risks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_logs_config_idx" ON "ai_usage_logs" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_student_idx" ON "ai_usage_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_time_idx" ON "ai_usage_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "certificates_student_idx" ON "certificates" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_course_idx" ON "enrollments" USING btree ("student_id","course_id");--> statement-breakpoint
CREATE INDEX "lessons_module_idx" ON "lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "modules_course_idx" ON "modules" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "support_tickets_student_idx" ON "support_tickets" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");