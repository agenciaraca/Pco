/**
 * A página do curso não pode anunciar um número de módulos e listar outro.
 *
 * Medido em produção em 9/set/2026, no carro-chefe: o chip do topo diz
 * **19 módulos** e a grade "Conteúdo do curso" lista **15**. Os dois estão na
 * mesma página, e quem lê antes de comprar vê os dois.
 *
 * A causa não é erro de contagem — são **duas fontes**. Os chips saem dos
 * `modules` do curso; a grade sai de `curriculum`, campo editorial digitado à
 * mão no admin. Começaram iguais e divergiram quando o curso ganhou módulos e
 * ninguém voltou ao texto. Nada dá erro: a página responde 200 e os quatro
 * módulos que o aluno compra simplesmente não aparecem onde ele decide.
 *
 * **Curso sem grade não é divergência**, e o teste cobra isso: a seção inteira
 * some da página, o que é omissão deliberada e não contradição. Três dos
 * quatro cursos estão assim, e alarmar sobre eles encheria o painel de aviso
 * sem ação atrás — o mesmo cuidado do alarme de parcelamento.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
const DATA_DIR_ORIGINAL = process.env.DATA_DIR;

/** Um curso cru no formato do seed, com N módulos e M itens de grade. */
function curso(
  id: string,
  title: string,
  modulos: number,
  itensDeGrade: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    title,
    slug: id,
    description: 'x',
    modules: Array.from({ length: modulos }, (_, i) => ({
      id: `${id}-m${i}`,
      title: `Módulo ${i + 1}`,
      lessons: [],
    })),
    curriculum: Array.from({ length: itensDeGrade }, (_, i) => ({
      n: String(i + 1).padStart(2, '0'),
      title: `Item ${i + 1}`,
    })),
    ...extra,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-grade-'));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
});

afterEach(async () => {
  if (DATA_DIR_ORIGINAL === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = DATA_DIR_ORIGINAL;
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

async function escreverCursos(cursos: unknown[]): Promise<void> {
  await fs.writeFile(path.join(tmpDir, 'courses.json'), JSON.stringify(cursos), 'utf8');
}

describe('coerência da vitrine', () => {
  it('acusa a grade que lista menos módulos do que o curso tem', async () => {
    // Os números do caso real.
    await escreverCursos([curso('psicanalise', 'Curso de Psicanálise Clínica', 19, 15)]);
    const { conferirGrades } = await import('../server/public/vitrine-coerente');
    const r = await conferirGrades();
    expect(r.erro).toBeNull();
    expect(r.divergentes).toHaveLength(1);
    expect(r.divergentes[0]!.modulos).toBe(19);
    expect(r.divergentes[0]!.naGrade).toBe(15);
  });

  it('acusa também a grade que promete módulos que não existem', async () => {
    // O sentido inverso é pior: a página lista conteúdo que o curso não tem.
    await escreverCursos([curso('x', 'Curso X', 5, 8)]);
    const { conferirGrades } = await import('../server/public/vitrine-coerente');
    const r = await conferirGrades();
    expect(r.divergentes).toHaveLength(1);
    expect(r.divergentes[0]!.naGrade).toBeGreaterThan(r.divergentes[0]!.modulos);
  });

  it('grade batendo com os módulos não vira aviso', async () => {
    await escreverCursos([curso('ok', 'Curso OK', 6, 6)]);
    const { conferirGrades } = await import('../server/public/vitrine-coerente');
    const r = await conferirGrades();
    expect(r.divergentes).toEqual([]);
    expect(r.conferidos, 'foi conferido de verdade — não pulou').toBe(1);
  });

  it('curso SEM grade não é divergência — é omissão deliberada', async () => {
    // Três dos quatro cursos de produção estão assim. Alarmar encheria o
    // painel de aviso sem ação atrás.
    await escreverCursos([curso('sem-grade', 'Sem grade', 9, 0)]);
    const { conferirGrades } = await import('../server/public/vitrine-coerente');
    const r = await conferirGrades();
    expect(r.divergentes).toEqual([]);
    expect(r.conferidos, 'não conta como conferido: não havia o que conferir').toBe(0);
  });

  it('curso fora da vitrine não entra na conta', async () => {
    // Contradição em curso interno é problema de catálogo, não de página de
    // compra — e o painel é sobre o que custa venda.
    await escreverCursos([curso('interno', 'Treinamento', 8, 3, { publicListed: false })]);
    const { conferirGrades } = await import('../server/public/vitrine-coerente');
    const r = await conferirGrades();
    expect(r.divergentes).toEqual([]);
  });

  it('o painel de saúde mostra os dois números', async () => {
    await escreverCursos([curso('psicanalise', 'Curso de Psicanálise Clínica', 19, 15)]);
    const { buildSnapshot } = await import('../server/health/dashboard');
    const check = (await buildSnapshot()).checks.find((c) => c.id === 'vitrine-grade');
    expect(check, 'o painel não pergunta pela grade').toBeTruthy();
    expect(check!.status).toBe('warn');
    // O número anda com a base: sem os dois, o aviso não diz o que consertar.
    expect(check!.message).toContain('19');
    expect(check!.message).toContain('15');
  });

  it('sem divergência o painel fica quieto', async () => {
    await escreverCursos([curso('ok', 'Curso OK', 6, 6)]);
    const { buildSnapshot } = await import('../server/health/dashboard');
    expect((await buildSnapshot()).checks.find((c) => c.id === 'vitrine-grade')).toBeUndefined();
  });
});
