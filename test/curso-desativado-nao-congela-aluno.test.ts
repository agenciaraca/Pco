import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * LEARN3-001 · desativar um curso não pode congelar quem está estudando.
 *
 * `listCourses()` filtra `active = true`, e isso está certo para **descoberta**:
 * curso desativado não aparece na vitrine nem na estante. O problema é que duas
 * rotas de operação passaram a depender dele.
 *
 * `POST /lessons/:id/complete` e `POST /me/lessons/:id/watch` resolvem curso e
 * módulo a partir do `lessonId` — de propósito, para não confiar no `courseId`
 * que o cliente mandou (foi assim que se emitia certificado com ids de aula de
 * outro curso). As duas passam por `localizarAula`, e ela varria `listCourses()`.
 *
 * Efeito: enquanto um curso estivesse desativado — para edição, ou porque
 * `deleteCourse` é um `active: false` —, quem estivesse com a aula aberta
 * recebia `404 NOT_FOUND` ao concluir a aula e ao reportar tempo assistido. O
 * 404 se lê como "esta aula não existe". E o tempo de assistência alimenta o
 * cálculo de risco de evasão: o aluno seguia estudando e os dois sinais
 * pedagógicos paravam juntos, sem erro para ninguém.
 *
 * O filtro só existe no caminho de **banco** — no modo JSON o store devolve
 * tudo. Por isso o teste observa a consulta montada, e não o resultado: em modo
 * JSON as duas funções são indistinguíveis, e é justamente em produção, que usa
 * banco, que elas precisam diferir.
 */

const espiao = vi.hoisted(() => ({ filtros: [] as unknown[] }));

const bancoFalso = vi.hoisted(() => {
  const alvo = {
    // `where(undefined)` é como o Drizzle recebe "sem filtro".
    where: (filtro: unknown) => {
      espiao.filtros.push(filtro);
      return Promise.resolve([] as unknown[]);
    },
  };
  return {
    select: () => ({ from: () => alvo }),
  };
});

vi.mock('../server/db/client', async () => {
  const real = await vi.importActual<typeof import('../server/db/client')>(
    '../server/db/client',
  );
  return { ...real, getDb: () => bancoFalso, hasDb: () => true };
});

let repo: typeof import('../server/repositories/courses');

beforeEach(async () => {
  espiao.filtros = [];
  if (!repo) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cursos-'));
    process.env.DATA_DIR = tmp;
    repo = await import('../server/repositories/courses');
  }
});

describe('o catálogo filtra por `active`; a operação sobre a aula, não', () => {
  it('listCourses só traz curso ativo — é o que vai para a vitrine', async () => {
    await repo.listCourses();
    expect(espiao.filtros).toHaveLength(1);
    expect(espiao.filtros[0]).toBeDefined();
  });

  it('listCoursesIncludingInactive não filtra — o aluno já está com a aula aberta', async () => {
    await repo.listCoursesIncludingInactive();
    expect(espiao.filtros).toHaveLength(1);
    expect(espiao.filtros[0]).toBeUndefined();
  });
});

describe('as duas rotas de operação usam a variante sem filtro', () => {
  /**
   * Guarda estrutural, e ela existe porque o defeito foi **herdado**: fechar o
   * portão de `watch` (`8d2ac7e`) reusou `localizarAula` — reuso correto em
   * princípio — e levou junto o filtro que ela já carregava. De um chamador
   * para dois, sem que ninguém tivesse escrito a regra em lugar nenhum.
   */
  it('localizarAula não volta a varrer o catálogo filtrado', async () => {
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'app.ts'),
      'utf8',
    );
    const i = fonte.indexOf('async function localizarAula');
    expect(i).toBeGreaterThan(0);
    const corpo = fonte.slice(i, i + 900);
    expect(corpo).toContain('listCoursesIncludingInactive()');
    expect(corpo).not.toMatch(/coursesRepo\.listCourses\(\)/);
  });
});
