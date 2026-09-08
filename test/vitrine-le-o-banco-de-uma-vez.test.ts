import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * As quatro leituras do curso saem juntas, não uma esperando a outra.
 *
 * ## O que se mediu
 *
 * `loadFromDb` lia `courses`, `modules`, `lessons` e `assessments` em quatro
 * `await` sequenciais, e **nenhuma depende do resultado da outra**: as três
 * últimas são lidas inteiras e cruzadas em memória. O banco é remoto (DivZ),
 * então cada `await` custava um ida-e-volta.
 *
 * Medido no próprio VPS em 8/set/2026, com `curl` no `127.0.0.1` e o `Host`
 * certo (sem ele a app responde 301 e a medição vira o custo do redirect):
 * home 0,96 s, `/formacoes` 0,91 s, curso 0,89 s, checkout 0,89 s — contra
 * 0,47 s do blog, que lê **uma** coisa só. A conta fecha: o tempo da página
 * pública era o número de ida-e-voltas.
 *
 * É a mesma forma do defeito que `numerosDoSite` tinha em 8/set — leituras
 * independentes esperando uma pela outra —, uma camada abaixo, e no caminho de
 * **toda** página pública, checkout inclusive.
 *
 * ## Por que o teste mede concorrência, e não o texto do código
 *
 * Afirmar que o arquivo contém `Promise.all` passaria com um `Promise.all` de
 * uma promessa só, e quebraria em qualquer refatoração honesta. O que importa é
 * **quantas leituras estão no ar ao mesmo tempo**: sequencial nunca passa de 1.
 */

/** Conta quantas leituras estão no ar, e o pico. */
const espiao = vi.hoisted(() => ({ emVoo: 0, pico: 0, chamadas: [] as string[] }));

const linhaDeCurso = vi.hoisted(() => ({
  id: 'c-1',
  slug: 'c-1',
  title: 'Curso',
  shortTitle: 'Curso',
  description: '',
  coverColor: 'from-pco-blue to-pco-cyan',
  totalHours: 1,
  certificateAvailable: false,
  active: true,
  meta: {},
}));

const bancoFalso = vi.hoisted(() => {
  const linhas: Record<string, unknown[]> = {
    courses: [linhaDeCurso],
    modules: [],
    lessons: [],
    assessments: [],
  };
  /** Toda pgTable carrega o nome neste símbolo. */
  function nomeDaTabela(t: object): string {
    const s = Object.getOwnPropertySymbols(t).find((x) => x.description === 'drizzle:Name');
    return s ? String((t as Record<symbol, unknown>)[s]) : '?';
  }
  /**
   * Uma leitura que demora. O atraso é o que torna a sobreposição visível:
   * resolvendo na hora, sequencial e paralelo dariam o mesmo pico.
   */
  function ler(nome: string): Promise<unknown[]> {
    espiao.emVoo++;
    espiao.chamadas.push(nome);
    espiao.pico = Math.max(espiao.pico, espiao.emVoo);
    return new Promise((resolve) =>
      setTimeout(() => {
        espiao.emVoo--;
        resolve(linhas[nome] ?? []);
      }, 5),
    );
  }
  return {
    select: () => ({
      from: (t: object) => {
        const nome = nomeDaTabela(t);
        return {
          where: () => ler(nome),
          orderBy: () => ler(nome),
          // Await direto na cadeia, sem `where` nem `orderBy`.
          then: (ok: (v: unknown[]) => unknown, err?: (e: unknown) => unknown) =>
            ler(nome).then(ok, err),
        };
      },
    }),
  };
});

vi.mock('../server/db/client', async () => {
  const real = await vi.importActual<typeof import('../server/db/client')>('../server/db/client');
  return { ...real, getDb: () => bancoFalso, hasDb: () => true };
});

let repo: typeof import('../server/repositories/courses');

beforeEach(async () => {
  espiao.emVoo = 0;
  espiao.pico = 0;
  espiao.chamadas = [];
  if (!repo) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-vitrine-'));
    process.env.DATA_DIR = tmp;
    repo = await import('../server/repositories/courses');
  }
});

describe('a leitura de curso no banco', () => {
  it('põe as quatro tabelas no ar ao mesmo tempo', async () => {
    await repo.listCoursesResumidos();

    expect(espiao.chamadas.sort()).toEqual(['assessments', 'courses', 'lessons', 'modules']);
    // Contra o código anterior isto era 1: cada `await` esperava o anterior.
    expect(espiao.pico, 'as leituras continuam em fila').toBe(4);
  });

  it('vale também para a leitura completa, que é a do aluno e a do admin', async () => {
    await repo.listCourses();
    expect(espiao.pico).toBe(4);
  });

  it('não sobra leitura no ar quando termina', async () => {
    await repo.listCourses();
    expect(espiao.emVoo).toBe(0);
  });
});

describe('e o resultado continua o mesmo', () => {
  it('devolve o curso montado, com módulos e aulas cruzados em memória', async () => {
    const cursos = await repo.listCoursesResumidos();
    expect(cursos).toHaveLength(1);
    expect(cursos[0]!.id).toBe('c-1');
    // `active` precisa vir junto: `isPubliclyListed` é
    // `active !== false && publicListed !== false`, e sem o campo ela lê
    // `undefined` e deixa passar curso despublicado para a vitrine.
    expect(cursos[0]!.active).toBe(true);
  });
});
