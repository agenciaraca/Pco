/**
 * A home lia a árvore de cursos duas vezes por visita.
 *
 * Medido em produção em 8/set/2026, com `curl` no `127.0.0.1` do próprio VPS —
 * sem rede no meio: **2,5 a 3,7 segundos de tempo de servidor** só para
 * responder a home. No celular com 4G lento isso virava LCP de 6,9 s; as outras
 * páginas ficavam em 1,4 s e o blog em 0,46 s.
 *
 * Cronometrado leitura a leitura contra o banco de produção: `numerosDoSite`
 * 2483 ms, `listPublicCourses` 1054 ms, `listPublicPosts` 412 ms. Dentro de
 * `numerosDoSite` as três leituras rodavam em **sequência**, e a pior era
 * `coursesRepo.listCourses()` — a árvore inteira, com o conteúdo das 590 aulas,
 * **só para contar quantas aulas existem**.
 *
 * O que este arquivo trava:
 *
 * 1. **Uma leitura da árvore por requisição**, não duas.
 * 2. **Requisição diferente lê de novo** — é o que separa este memo de um
 *    cache: nada de vitrine mostrando por um minuto o curso que o admin acabou
 *    de despublicar.
 * 3. **Falha não fica guardada.** Se o erro ficasse no armazém, "não consegui
 *    ler" viraria "não existe" para o resto da requisição.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { comMemoDaRequisicao, memoDaRequisicao } from '../server/public/memo-da-requisicao';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-vitrine-'));
  process.env.DATA_DIR = tmpDir;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('memo por requisição', () => {
  it('lê uma vez dentro da mesma requisição', async () => {
    const ler = vi.fn(async () => ({ n: 1 }));
    await comMemoDaRequisicao(async () => {
      const a = await memoDaRequisicao('x', ler);
      const b = await memoDaRequisicao('x', ler);
      expect(b).toBe(a);
    });
    expect(ler).toHaveBeenCalledTimes(1);
  });

  it('a requisição SEGUINTE lê de novo — não é cache', async () => {
    // É o ponto do desenho: um cache com relógio deixaria a vitrine mostrando
    // por até um minuto um curso que o admin acabou de despublicar, e
    // `publicListed` foi a marca que segurava o curso interno de operadores.
    const ler = vi.fn(async () => 1);
    await comMemoDaRequisicao(() => memoDaRequisicao('y', ler));
    await comMemoDaRequisicao(() => memoDaRequisicao('y', ler));
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it('duas chamadas simultâneas compartilham a mesma ida ao banco', async () => {
    let solta: ((v: number) => void) | null = null;
    const ler = vi.fn(
      () =>
        new Promise<number>((r) => {
          solta = r;
        }),
    );
    await comMemoDaRequisicao(async () => {
      const p1 = memoDaRequisicao('z', ler);
      const p2 = memoDaRequisicao('z', ler);
      expect(ler).toHaveBeenCalledTimes(1);
      solta!(7);
      expect(await p1).toBe(7);
      expect(await p2).toBe(7);
    });
  });

  it('FALHA não fica guardada dentro da requisição', async () => {
    const ler = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('banco caiu'))
      .mockResolvedValueOnce('ok');
    await comMemoDaRequisicao(async () => {
      await expect(memoDaRequisicao('w', ler)).rejects.toThrow('banco caiu');
      await expect(memoDaRequisicao('w', ler)).resolves.toBe('ok');
    });
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it('fora de requisição não há memo, e a leitura simplesmente acontece', async () => {
    const ler = vi.fn(async () => 1);
    await memoDaRequisicao('fora', ler);
    await memoDaRequisicao('fora', ler);
    expect(ler).toHaveBeenCalledTimes(2);
  });
});

describe('a home', () => {
  it('lê a árvore UMA vez, e pela variante que não traz o corpo das aulas', async () => {
    const repo = await import('../server/repositories/courses');
    const resumido = vi.spyOn(repo, 'listCoursesResumidos');
    const completo = vi.spyOn(repo, 'listCourses');
    const { listPublicCourses, numerosDoSite } = await import('../server/public/projections');

    await comMemoDaRequisicao(async () => {
      // É o que a home faz: as duas em paralelo.
      await Promise.all([listPublicCourses(), numerosDoSite('2018')]);
    });

    // Duas chamadas era o defeito: ~3 MB de conteúdo de aula vindo do banco
    // remoto duas vezes, para a mesma página.
    expect(resumido).toHaveBeenCalledTimes(1);
    // E a vitrine não pode voltar a usar a leitura completa: ela traz
    // `lessons.content` — a apostila inteira — para montar três cartões.
    expect(completo).not.toHaveBeenCalled();
    resumido.mockRestore();
    completo.mockRestore();
  });

  it('os números saem completos, e cada um com o seu próprio safe()', async () => {
    const { numerosDoSite } = await import('../server/public/projections');
    const n = await comMemoDaRequisicao(() => numerosDoSite('2018'));
    expect(n).toHaveProperty('avaliacao');
    expect(n).toHaveProperty('formados');
    expect(n).toHaveProperty('aulas');
    expect(n.anos).toBeGreaterThan(0);
  });
});
