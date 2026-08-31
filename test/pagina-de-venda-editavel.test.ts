import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { updateCourseSchema } from '../shared/schemas';

/**
 * Tudo o que a página de venda mostra tem de ter onde ser escrito.
 *
 * Em 31/ago/2026 o dono perguntou onde montava o conteúdo comercial do curso.
 * A resposta era constrangedora: metade dos blocos da página — destaques,
 * seções longas, jornada, o que o aluno desenvolve e o regulamento da promoção —
 * existia no schema e na página, mas **não tinha campo no admin**. Só entrava
 * por script, rodado por alguém com shell.
 *
 * Campo que a página mostra e o dono não consegue editar é pior que campo que
 * não existe: a tela promete um conteúdo que ninguém consegue manter.
 */
const pane = readFileSync(
  resolve(process.cwd(), 'src/app/pages/admin/CoursePublicPane.tsx'),
  'utf-8',
);
const projections = readFileSync(resolve(process.cwd(), 'server/public/projections.ts'), 'utf-8');

/** Campos de CONTEÚDO da página de venda — o que alguém escreve, não o que o sistema calcula. */
const CAMPOS_DE_CONTEUDO = [
  'badge',
  'tagline',
  'tldr',
  'level',
  'language',
  'forWhom',
  'faqs',
  'curriculum',
  'learningOutcomes',
  'highlights',
  'sections',
  'jornada',
  'promoNote',
] as const;

describe('o conteúdo comercial do curso é editável no admin', () => {
  it('o schema aceita todos os campos de conteúdo', () => {
    const forma = updateCourseSchema.shape as Record<string, unknown>;
    for (const campo of CAMPOS_DE_CONTEUDO) {
      expect(forma[campo], `o schema não aceita ${campo}`).toBeDefined();
    }
  });

  it('a aba "Página pública" tem onde escrever cada um deles', () => {
    for (const campo of CAMPOS_DE_CONTEUDO) {
      expect(pane.includes(campo), `sem campo no admin para "${campo}"`).toBe(true);
    }
  });

  it('a projeção pública continua sendo a lista fechada de sempre', () => {
    // Se um campo novo aparecer na página sem passar por aqui, a whitelist da
    // projeção é o lugar onde isso deve doer — e não em produção.
    for (const campo of ['highlights', 'sections', 'jornada', 'promoNote']) {
      expect(projections.includes(campo), `${campo} sumiu da projeção pública`).toBe(true);
    }
  });
});
