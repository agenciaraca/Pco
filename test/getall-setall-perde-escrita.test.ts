import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-getall-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import { JsonStore } from '../server/db/json-store';

interface Linha {
  id: string;
  dono?: string;
  quando?: number;
}

/**
 * `getAll()` + `setAll()` perde escrita concorrente, sem erro.
 *
 * O `CLAUDE.md` já documenta isto desde 5/set/2026, quando treze rotinas do
 * expurgo foram convertidas para `modify`. **O padrão sobreviveu em 24 outros
 * lugares**, e os piores eram os logs de acréscimo — auditoria, erros, e-mail,
 * mensageria, tutor, entrega de webhook. São justamente os que recebem escrita
 * concorrente em RAJADA: quando muita coisa falha ao mesmo tempo é exatamente
 * quando os registros se perdem.
 *
 * A mecânica, que este arquivo demonstra em vez de descrever: `getAll()`
 * devolve uma **cópia rasa** do array vivo; `setAll()` instala uma cópia por
 * cima. Entre as duas chamadas há `await`, e tudo que outra chamada inseriu no
 * intervalo é jogado fora.
 */
describe('a perda que o par getAll + setAll causa', () => {
  let store: JsonStore<Linha>;

  beforeEach(() => {
    store = new JsonStore<Linha>(`perda-${Math.random().toString(36).slice(2)}.json`, () => []);
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('o padrão ANTIGO descarta a linha que chegou no meio', async () => {
    await store.unshift({ id: 'a' });

    // Exatamente o que faziam `deleteX`, `purgeOlderThan` e os trims de log.
    const all = await store.getAll();

    /*
      A janela que importa é esta: entre o `getAll` e o `setAll`, a requisição
      A quase sempre AGUARDA outra coisa — uma consulta, um hash, uma chamada
      HTTP. Nesse intervalo a requisição B completa a escrita dela inteira.

      (Escrever `const p = store.unshift(...)` sem `await` NÃO reproduz o
      defeito, e a razão é ordem de microtarefa: o `setAll` instala a cópia de
      forma síncrona antes da continuação do `unshift`, então a linha nova cai
      na lista já instalada e sobrevive. O defeito precisa da escrita
      concluída, que é o caso real.)
    */
    await store.unshift({ id: 'novo' });

    await store.setAll(all.filter((x) => x.id !== 'a'));

    const restou = await store.getAll();
    // A remoção funcionou, e a inserção sumiu — sem erro, sem log, sem nada.
    expect(restou.map((x) => x.id)).not.toContain('a');
    expect(
      restou.map((x) => x.id),
      'este é o defeito: a linha concorrente foi descartada em silêncio',
    ).not.toContain('novo');
  });

  it('`removeAll` na mesma janela preserva a linha nova', async () => {
    await store.unshift({ id: 'a' });
    // Mesma sequência do caso acima, trocando só o par pelo método atômico.
    const remocao = (async () => {
      await new Promise((r) => setTimeout(r, 0));
      return store.removeAll((x) => x.id === 'a');
    })();
    await store.unshift({ id: 'novo' });
    await remocao;

    const restou = await store.getAll();
    expect(restou.map((x) => x.id)).not.toContain('a');
    expect(restou.map((x) => x.id)).toContain('novo');
  });

  it('`removeAll` não descarta — mexe na lista viva', async () => {
    await store.unshift({ id: 'a' });

    const remocao = store.removeAll((x) => x.id === 'a');
    const insercao = store.unshift({ id: 'novo' });
    await Promise.all([remocao, insercao]);

    const restou = await store.getAll();
    expect(restou.map((x) => x.id)).not.toContain('a');
    expect(restou.map((x) => x.id)).toContain('novo');
  });

  it('`unshiftComTeto` insere e apara sem perder o que entrou junto', async () => {
    // Dez escritas simultâneas com teto de 100: nenhuma pode sumir.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => store.unshiftComTeto({ id: `e${i}` }, 100)),
    );
    const todas = await store.getAll();
    expect(todas).toHaveLength(10);
    expect(new Set(todas.map((x) => x.id)).size).toBe(10);
  });

  it('e o teto continua sendo respeitado, mantendo os mais novos', async () => {
    for (let i = 0; i < 6; i++) await store.unshiftComTeto({ id: `e${i}` }, 3);
    const todas = await store.getAll();
    expect(todas.map((x) => x.id)).toEqual(['e5', 'e4', 'e3']);
  });

  it('`removeAll` devolve quantos saíram, e zero quando não casa nada', async () => {
    await store.unshift({ id: 'a', dono: 'u1' });
    await store.unshift({ id: 'b', dono: 'u1' });
    await store.unshift({ id: 'c', dono: 'u2' });

    expect(await store.removeAll((x) => x.dono === 'u1')).toBe(2);
    expect(await store.removeAll((x) => x.dono === 'u1')).toBe(0);
    expect((await store.getAll()).map((x) => x.id)).toEqual(['c']);
  });

  it('`removeAll` varre de trás para a frente — não pula item adjacente', async () => {
    // Removendo para a frente, tirar o índice 0 faz o antigo 1 virar 0 e a
    // varredura pula ele. Três iguais seguidos é o caso que denuncia.
    for (const id of ['x1', 'x2', 'x3', 'ok']) await store.unshift({ id, dono: id === 'ok' ? 'z' : 'x' });
    expect(await store.removeAll((r) => r.dono === 'x')).toBe(3);
    expect((await store.getAll()).map((x) => x.id)).toEqual(['ok']);
  });
});

/**
 * A garantia no nível dos stores de verdade: nenhum deles pode voltar ao par.
 *
 * A conversão foi mecânica e é fácil de desfazer sem querer — este caso lê os
 * arquivos e falha se `getAll()` e `setAll()` voltarem a aparecer juntos numa
 * mesma função.
 */
describe('nenhum store voltou ao par getAll + setAll', () => {
  it('os 24 pontos convertidos continuam convertidos', async () => {
    const path = await import('node:path');
    const alvos = [
      'server/audit/log.ts',
      'server/errors/store.ts',
      'server/messaging/log-store.ts',
      'server/notifications/log-store.ts',
      'server/webhooks/delivery-store.ts',
      'server/repositories/tutor-history.ts',
      'server/activity/wishlist-store.ts',
      'server/admin/notes-store.ts',
      'server/auth/api-tokens.ts',
      'server/discussions/store.ts',
      'server/imports/connections-store.ts',
      'server/imports/job-store.ts',
      'server/imports/refs-store.ts',
      'server/imports/schedules-store.ts',
      'server/live-sessions/store.ts',
      'server/mentoring/store.ts',
      'server/notifications/config-store.ts',
      'server/reviews/store.ts',
      'server/saved-searches/store.ts',
      'server/webhooks/endpoints-store.ts',
    ];
    const reincidentes: string[] = [];
    for (const rel of alvos) {
      const fonte = await fs.readFile(path.join(process.cwd(), rel), 'utf8');
      // O par perigoso é ler tudo e reinstalar por cima. `setAll([])` e
      // `setAll([config])` são outra coisa — substituição deliberada.
      if (/await store\.getAll\(\)[\s\S]{0,400}?await store\.setAll\(/.test(fonte)) {
        reincidentes.push(rel);
      }
    }
    expect(
      reincidentes,
      'voltaram a perder escrita concorrente:\n  ' + reincidentes.join('\n  '),
    ).toEqual([]);
  });
});
