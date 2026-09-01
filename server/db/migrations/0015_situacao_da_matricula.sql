-- Situação da matrícula: ativa / suspensa / cancelada.
--
-- Escrita à mão em cima do que o gerador produziu. O gerador quis recriar
-- `analytics_daily` e `payment_products`, que já existem em produção desde as
-- migrations 0013 e 0014 — é o desencontro de carimbo do journal descrito em
-- docs/deploy.md. Recriar derrubaria a migração inteira no `already exists`.
--
-- Guardas por toda parte: esta migration precisa poder rodar em base nova e em
-- base que já viu parte do caminho.
DO $$ BEGIN
  CREATE TYPE "public"."enrollment_status" AS ENUM('ativa', 'suspensa', 'cancelada');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "status" "enrollment_status" DEFAULT 'ativa' NOT NULL;
