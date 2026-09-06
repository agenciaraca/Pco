import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DECISOES } from '../server/privacy/expurgo';

/**
 * PRIV2-001 · o expurgo de dados não existia.
 *
 * Marcar a solicitação de exclusão como `completed` gravava um campo e uma
 * nota. **Nada era apagado em lugar nenhum.** Não havia rotina de expurgo, não
 * havia rota de exclusão de usuário, e `deleteUser()` vivia no store sem
 * nenhum chamador. A escola dizia ao titular que a exclusão estava concluída e
 * guardava tudo.
 *
 * ## A garantia que este arquivo cobra
 *
 * **O que a exportação entrega é o que o expurgo tem de tratar.** As duas
 * respondem à mesma pergunta — "o que vocês guardam sobre mim?" — e não podem
 * discordar. Categoria que sai no `/me/export` e não aparece nas decisões do
 * expurgo é dado que a escola **admite ter** e não sabe apagar; o inverso é
 * decisão de exclusão sobre dado que ninguém declarou guardar.
 *
 * A lista da exportação vive em `test/exportacao-e-completa.test.ts` com um
 * motivo escrito por categoria. Aqui ela é lida de lá, do arquivo, para que as
 * duas não virem duas cópias livres para divergir — que é o defeito que este
 * projeto passou a semana inteira consertando em outros lugares.
 */

/** As chaves do inventário da exportação, lidas do próprio arquivo de teste. */
async function categoriasDaExportacao(): Promise<string[]> {
  const fonte = await fs.readFile(
    path.join(process.cwd(), 'test', 'exportacao-e-completa.test.ts'),
    'utf8',
  );
  const i = fonte.indexOf('const CATEGORIAS: Record<string, string> = {');
  const j = fonte.indexOf('\n};', i);
  expect(i, 'não achei o inventário da exportação').toBeGreaterThan(0);
  const bloco = fonte.slice(i, j);
  const chaves: string[] = [];
  for (const m of bloco.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)) chaves.push(m[1]!);
  return chaves.sort();
}

describe('o expurgo trata tudo o que a exportação entrega', () => {
  it('nenhuma categoria da exportação ficou sem decisão de expurgo', async () => {
    const exportadas = await categoriasDaExportacao();
    const decididas = new Set(DECISOES.map((d) => d.categoria));
    const semDecisao = exportadas.filter((c) => !decididas.has(c));

    expect(
      semDecisao,
      'a escola admite guardar estes dados e não sabe o que fazer com eles numa ' +
        'exclusão:\n  ' + semDecisao.join('\n  '),
    ).toEqual([]);
  });

  it('e nenhuma decisão fala de dado que a exportação não declara', async () => {
    const exportadas = new Set(await categoriasDaExportacao());
    const sobrando = DECISOES.map((d) => d.categoria).filter((c) => !exportadas.has(c));
    expect(
      sobrando,
      'estas categorias são apagadas e não aparecem no que a escola declara guardar:\n  ' +
        sobrando.join('\n  '),
    ).toEqual([]);
  });

  it('a lista não está vazia — senão as comparações acima seriam decoração', async () => {
    expect((await categoriasDaExportacao()).length).toBeGreaterThan(15);
    expect(DECISOES.length).toBeGreaterThan(15);
  });
});

describe('reter é decisão jurídica, e vem com o motivo escrito', () => {
  it('toda categoria retida diz por quê', () => {
    for (const d of DECISOES.filter((x) => x.destino === 'reter')) {
      expect(d.motivo, `"${d.categoria}" é retida sem justificativa`).toBeTruthy();
      expect((d.motivo ?? '').length, `justificativa curta demais em "${d.categoria}"`).toBeGreaterThan(40);
    }
  });

  it('pedido pago e certificado são os retidos, e citam a razão legal', () => {
    // Não é escolha de conveniência: LGPD art. 16, I manda guardar o que outra
    // lei obriga a guardar, e a obrigação fiscal é de cinco anos. Certificado
    // é declaração a terceiros, com código de validação público.
    const retidas = DECISOES.filter((d) => d.destino === 'reter').map((d) => d.categoria);
    expect(retidas).toContain('orders');
    expect(retidas).toContain('certificates');
    const pedidos = DECISOES.find((d) => d.categoria === 'orders');
    expect(pedidos?.motivo).toMatch(/fiscal|art\. 16/i);
  });

  it('nada é retido em silêncio: quem não retém não inventa motivo', () => {
    for (const d of DECISOES.filter((x) => x.destino !== 'reter')) {
      expect(d.motivo, `"${d.categoria}" não é retida e mesmo assim tem motivo de retenção`)
        .toBeUndefined();
    }
  });
});

describe('o ensaio é o padrão da operação mais destrutiva do sistema', () => {
  let tmpDir: string;
  let expurgo: typeof import('../server/privacy/expurgo');

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-expurgo-'));
    process.env.DATA_DIR = tmpDir;
    expurgo = await import('../server/privacy/expurgo');
  });

  afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('sem commit, nada é tratado', async () => {
    const r = await expurgo.expurgarTitular('u-inexistente');
    expect(r.executou).toBe(false);
    for (const item of r.itens) {
      expect(item.tratados, `"${item.categoria}" foi tratada num ensaio`).toBe(0);
    }
  });

  it('categoria sem rotina de limpeza derruba o "completo"', async () => {
    // O honesto: dez categorias ainda não têm rotina no repositório delas, e o
    // expurgo diz isso em vez de reportar sucesso. Enquanto houver uma, a
    // solicitação não pode virar "concluída" — que era exatamente a mentira
    // que esta rotina existe para acabar.
    const r = await expurgo.expurgarTitular('u-inexistente');
    expect(r.completo).toBe(false);
    const semRotina = r.itens.filter((i) => i.erro);
    expect(semRotina.length).toBeGreaterThan(0);
    for (const i of semRotina) expect(i.erro).toMatch(/sem rotina/);
  });
});
