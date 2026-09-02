-- A aula de demonstração passa a existir no banco.
--
-- O campo `isPreview` existia no schema Zod, no editor do admin e em cinco
-- telas do produto (selo do catálogo, lista de aula grátis da página do curso,
-- checklist de publicação). Só não existia na tabela. O caminho de banco —
-- que é produção desde sempre — descartava o campo ao gravar e devolvia
-- `undefined` ao ler, então `/lessons/:id/preview` respondia 403 para toda
-- aula e a caixa marcada pelo admin não tinha efeito nenhum.
--
-- `false` como padrão é o comportamento que já valia de fato: nenhuma aula era
-- preview. A migração não libera conteúdo pago por acidente.
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "is_preview" boolean DEFAULT false NOT NULL;

-- E a transcrição da aula, pelo mesmo motivo.
--
-- O editor do admin tem um painel de transcrição por idioma — três idiomas,
-- com botão de copiar de um para outro. Ele salva sem erro e o texto se perde:
-- o caminho de banco descartava o campo. As duas rotas que servem transcrição
-- respondiam `NO_TRANSCRIPT` para toda aula, e a explicação parecia ser
-- "ninguém cadastrou ainda".
--
-- Nulo aqui é honesto: significa "esta aula não tem transcrição", que é o
-- estado de todas as 590 hoje.
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "transcripts" jsonb;
