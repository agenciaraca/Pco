import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

// `json-store.ts` congela DATA_DIR no import (module-level const). Como os
// imports abaixo já puxam o store, setar a variável num beforeAll chega tarde:
// o store fica apontando para o `data/` REAL do projeto e o teste passa a
// escrever no dado de trabalho de quem rodou a suíte. Foi o que aconteceu em
// 17/ago/2026 — a suíte cheia falhou porque este arquivo e o `data/` real
// disputavam o mesmo courses.json. `vi.hoisted` roda acima dos imports, que é
// o único ponto em que dá para vencer essa ordem.
const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-plisted-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import { isPubliclyListed } from '../server/public/projections';
import { updateCourseSchema } from '../shared/schemas';
import { pickMetaFields, COURSE_COLUMNS } from '../server/repositories/courses';

// Antes desta flag, visibilidade pública e acesso do aluno eram a MESMA coisa
// (`active`). Consequência concreta: o "Treinamento PCO" — treinamento interno
// de equipe, com técnicas de venda — estava listado no site público, e tirá-lo
// de lá cortaria o acesso das 19 pessoas matriculadas nele.
//
// `publicListed` separa as duas. A regra que estes testes travam:
//   active=false        → fora do site E fora do LMS (não se vende o que ninguém cursa)
//   publicListed=false  → fora do site, acesso do aluno intacto
//   ausente             → visível (aditivo: nenhum curso existente muda)

type Row = Record<string, unknown>;

describe('isPubliclyListed — o portão único do site público', () => {
  it('curso sem nenhuma das flags é visível', () => {
    expect(isPubliclyListed({ id: '1' } as Row)).toBe(true);
  });

  it('publicListed ausente vale como visível (mudança aditiva)', () => {
    expect(isPubliclyListed({ active: true } as Row)).toBe(true);
    expect(isPubliclyListed({ active: true, publicListed: undefined } as Row)).toBe(true);
  });

  it('publicListed=false esconde do site sem depender de active', () => {
    expect(isPubliclyListed({ active: true, publicListed: false } as Row)).toBe(false);
  });

  it('active=false continua escondendo — não se divulga curso inacessível', () => {
    expect(isPubliclyListed({ active: false } as Row)).toBe(false);
    expect(isPubliclyListed({ active: false, publicListed: true } as Row)).toBe(false);
  });

  it('as duas flags são independentes: dá para estar ativo e não divulgado', () => {
    // Exatamente o caso do treinamento interno: aluno matriculado acessa,
    // visitante anônimo não encontra.
    const treinamentoInterno = { active: true, publicListed: false } as Row;
    expect(treinamentoInterno.active).toBe(true);
    expect(isPubliclyListed(treinamentoInterno)).toBe(false);
  });

  it('só `false` explícito esconde — valor truthy qualquer não conta', () => {
    expect(isPubliclyListed({ publicListed: true } as Row)).toBe(true);
    expect(isPubliclyListed({ publicListed: null } as Row)).toBe(true);
  });
});

describe('publicListed no contrato de validação', () => {
  it('aceita booleano e recusa string', () => {
    expect(updateCourseSchema.safeParse({ publicListed: false }).success).toBe(true);
    expect(updateCourseSchema.safeParse({ publicListed: true }).success).toBe(true);
    expect(updateCourseSchema.safeParse({ publicListed: 'nao' }).success).toBe(false);
  });

  it('é opcional — patch parcial sem o campo continua válido', () => {
    expect(updateCourseSchema.safeParse({ badge: 'X' }).success).toBe(true);
  });
});

describe('persistência', () => {
  it('não é coluna própria, então vai para o JSONB `meta`', () => {
    expect(COURSE_COLUMNS.has('publicListed')).toBe(false);
    expect(pickMetaFields({ publicListed: false })).toEqual({ publicListed: false });
  });

  it('não se mistura com `active`, que tem coluna própria', () => {
    expect(pickMetaFields({ active: false, publicListed: false })).toEqual({
      publicListed: false,
    });
  });
});

// O predicado sozinho não prova nada: o defeito original era justamente um
// caminho de leitura que não consultava a flag. Estes testes vão pela projeção
// de verdade, que é o que o site público chama.
describe('ponta a ponta pela projeção pública', () => {
  let repo: typeof import('../server/repositories/courses');
  let proj: typeof import('../server/public/projections');
  let app: ReturnType<typeof import('../server/app').buildApp>;
  let alvo: { id: string; slug?: string };

  beforeAll(async () => {
    // DATA_DIR já foi apontado para TMP_DIR lá em cima, antes dos imports.
    repo = await import('../server/repositories/courses');
    proj = await import('../server/public/projections');
    app = (await import('../server/app')).buildApp();
    const todos = await repo.listCourses();
    alvo = todos.find((c) => c.active !== false) ?? todos[0];
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('curso aparece no catálogo antes de ser escondido', async () => {
    const slugs = (await proj.listPublicCourses()).map((c) => c.id);
    expect(slugs).toContain(alvo.id);
  });

  it('publicListed=false o remove do catálogo E da página de venda', async () => {
    await repo.updateCourse(alvo.id, { publicListed: false });

    const catalogo = (await proj.listPublicCourses()).map((c) => c.id);
    expect(catalogo).not.toContain(alvo.id);

    const slug = alvo.slug ?? alvo.id;
    expect(await proj.getPublicCourseBySlug(slug)).toBeNull();
    // O redirect de URL antiga também não pode entregar o curso escondido.
    expect(await proj.getPublicCourseSlugById(alvo.id)).toBeNull();
  });

  it('mas o curso segue ATIVO — o aluno matriculado não perdeu acesso', async () => {
    const depois = await repo.findCourse(alvo.id);
    expect(depois?.active).not.toBe(false);
    expect((depois as unknown as Record<string, unknown>).publicListed).toBe(false);
  });

  it('voltar a marcar devolve o curso ao site', async () => {
    await repo.updateCourse(alvo.id, { publicListed: true });
    const catalogo = (await proj.listPublicCourses()).map((c) => c.id);
    expect(catalogo).toContain(alvo.id);
  });

  // Sumir da vitrine sem fechar a porta dos fundos não vale de nada: quem
  // guardou o slug ainda conseguiria postar o checkout direto. Este teste
  // trava o único caminho de compra anônima no mesmo portão do catálogo.
  it('POST /public/checkout recusa curso escondido, e só por estar escondido', async () => {
    const slug = alvo.slug ?? alvo.id;
    const post = () =>
      app.request('/api/public/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseSlug: slug,
          name: 'Visitante Teste',
          email: 'visitante.teste@exemplo.com.br',
          consent: true,
        }),
      });

    // Visível: pode faltar produto à venda (409), mas o curso é encontrado.
    const visivel = await post();
    expect((await visivel.clone().json()).error?.code).not.toBe('COURSE_NOT_FOUND');

    await repo.updateCourse(alvo.id, { publicListed: false });

    const escondido = await post();
    expect(escondido.status).toBe(404);
    expect((await escondido.json()).error?.code).toBe('COURSE_NOT_FOUND');

    await repo.updateCourse(alvo.id, { publicListed: true });
  });
});
