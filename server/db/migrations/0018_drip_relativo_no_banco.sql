-- O gotejamento relativo à matrícula passa a existir no banco.
--
-- `releaseAfterEnrollmentDays` — "este módulo só abre N dias depois que o aluno
-- se matriculou" — existia no `createModuleSchema`, no editor do admin, no tipo
-- do produto e no motor de liberação (`server/repositories/drip.ts`). Só não
-- existia na tabela. O caminho de banco, que é produção, descartava o valor no
-- insert, descartava no update e não devolvia na leitura.
--
-- É o quarto caso do mesmo padrão — depois de `content` (21/ago), `isPreview` e
-- `transcripts` (2/set) — e **o primeiro que falha abrindo**. Os outros três
-- deixavam de entregar conteúdo: aula truncada, preview que dava 403,
-- transcrição inexistente. Este liberava, imediatamente e para todo mundo, um
-- módulo que a coordenação tinha mandado segurar por 30 dias — e sem erro
-- nenhum, porque o formulário salva e a API responde 200.
--
-- Nulo é o comportamento que já valia de fato: nenhum módulo tinha drip
-- relativo em vigor, porque o campo nunca chegou ao banco. A migração não
-- tranca conteúdo de ninguém.
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "release_after_enrollment_days" integer;

-- As duas linhas abaixo são **repetição de propósito**, e valem uma explicação.
--
-- A 0017 foi escrita à mão e não gerou snapshot. Como o último snapshot do
-- drizzle-kit é o da 0016, o `generate` desta migração diffou contra ele e
-- reemitiu as colunas da 0017 junto. Em vez de apagá-las e deixar o journal
-- ainda mais fora de fase, elas ficam aqui com `IF NOT EXISTS`: num banco que
-- já recebeu a 0017 não fazem nada, e num que não recebeu, consertam.
--
-- A partir daqui existe `meta/0018_snapshot.json` cobrindo o schema inteiro, e
-- o próximo `generate` volta a diffar certo. Ver `docs/deploy.md` sobre carimbo
-- divergente no journal.
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "is_preview" boolean DEFAULT false NOT NULL;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "transcripts" jsonb;
