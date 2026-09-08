/**
 * Uma página do site nunca pode rodar um script mais velho que ela mesma.
 *
 * **Isto nasceu de um defeito medido em produção, em 8/set/2026.** O HTML do
 * site sai sem `Cache-Control` — cada visita traz a página nova. O script
 * saía de `/_pub/site.js`, endereço FIXO, com `max-age=3600`.
 *
 * Em 7/set o checkout passou a exigir data de nascimento e endereço: campos
 * novos no HTML, e um corpo novo montado pelo script. Quem já tinha visitado o
 * site recebeu a página nova por cima do script guardado. A pessoa via o
 * campo, preenchia a data, clicava em pagar — e o servidor respondia
 * **"Informe a data de nascimento"**, porque o script velho montava um corpo
 * sem aquela chave.
 *
 * Não havia o que a pessoa fizesse, e não havia erro em log nenhum: do lado do
 * servidor era um 400 de validação como outro qualquer, em 1 ms. O que se via
 * era a venda não acontecer.
 *
 * O teste cobra as três metades da regra, e a terceira é a que importa: que a
 * URL MUDE quando o script mudar. Uma impressão digital constante passaria
 * pelas outras duas e não protegeria nada.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { impressaoDigital, urlDoSiteJs } from '../server/public/versao-de-asset';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-asset-'));
  process.env.DATA_DIR = tmpDir;

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify([
      {
        id: 'c-1',
        slug: 'formacao-teste',
        title: 'Formação de Teste',
        description: 'Uma formação para o checkout.',
        coverColor: 'from-pco-blue to-pco-cyan',
        totalHours: 40,
        certificateAvailable: true,
        tags: [],
        modules: [],
      },
    ]),
    'utf8',
  );
  const agora = new Date().toISOString();
  await fs.writeFile(
    path.join(tmpDir, 'payment-products.json'),
    JSON.stringify([
      {
        id: 'p-1',
        name: 'Formação de Teste',
        kind: 'course',
        refId: 'c-1',
        priceCents: 99900,
        currency: 'BRL',
        active: true,
        createdAt: agora,
        updatedAt: agora,
      },
    ]),
    'utf8',
  );
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('a impressão digital do script', () => {
  it('muda quando o conteúdo muda', () => {
    const a = urlDoSiteJs('var x = 1;');
    const b = urlDoSiteJs('var x = 2;');
    expect(a).not.toBe(b);
    // E é estável: mesmo conteúdo, mesmo endereço — senão todo deploy
    // invalidaria o cache de quem não precisava buscar nada.
    expect(urlDoSiteJs('var x = 1;')).toBe(a);
  });

  it('cabe no formato que a rota reconhece', () => {
    expect(urlDoSiteJs('qualquer coisa')).toMatch(/^\/_pub\/v\/[0-9a-f]{8}\/site\.js$/);
  });
});

describe('a página servida e o script que ela carrega', () => {
  it('a home aponta para o endereço com a impressão do script ATUAL', async () => {
    const { publicSite } = await import('../server/public/router');
    const { PUBLIC_JS } = await import('../server/public/client');

    const res = await publicSite.fetch(new Request('http://local/'));
    expect(res.status).toBe(200);
    const html = await res.text();

    const esperado = `/_pub/v/${impressaoDigital(PUBLIC_JS)}/site.js`;
    expect(html).toContain(`<script src="${esperado}"`);
    // O endereço fixo não pode mais ser o que a página pede: era ele que
    // podia estar velho no navegador de quem já tinha visitado.
    expect(html).not.toContain('<script src="/_pub/site.js"');
  });

  it('esse endereço responde com o script, e pode ser guardado para sempre', async () => {
    const { publicSite } = await import('../server/public/router');
    const { PUBLIC_JS } = await import('../server/public/client');

    const url = `http://local/_pub/v/${impressaoDigital(PUBLIC_JS)}/site.js`;
    const res = await publicSite.fetch(new Request(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(PUBLIC_JS);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });

  it('o endereço antigo continua servindo — mas sem validade longa', async () => {
    const { publicSite } = await import('../server/public/router');
    const { PUBLIC_JS } = await import('../server/public/client');

    // Há páginas apontando para ele guardadas em navegador por aí. Um 404 aqui
    // deixaria essas páginas sem JS nenhum — sem menu no celular, sem
    // carrinho, sem checkout.
    const res = await publicSite.fetch(new Request('http://local/_pub/site.js'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(PUBLIC_JS);

    const cache = res.headers.get('Cache-Control') ?? '';
    const maxAge = Number(/max-age=(\d+)/.exec(cache)?.[1] ?? '0');
    expect(maxAge).toBeGreaterThan(0);
    // Uma hora era a janela em que a página nova rodava o script velho.
    expect(maxAge).toBeLessThanOrEqual(300);
  });
});

describe('o corpo que o script monta satisfaz o que o servidor exige', () => {
  /**
   * A outra metade da mesma classe: campo que o formulário mostra, a pessoa
   * preenche, e o script não envia. Aqui se lê o script de verdade e se
   * confere que toda chave exigida pelo checkout público sai dele.
   */
  it('o script envia todas as chaves que o checkout público exige', async () => {
    const { PUBLIC_JS } = await import('../server/public/client');

    for (const chave of ['birthDate', 'endereco', 'name', 'email', 'consent']) {
      expect(PUBLIC_JS, `o script não monta "${chave}"`).toContain(`${chave}:`);
    }
    for (const campo of ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf']) {
      expect(PUBLIC_JS, `o script não lê o campo "${campo}"`).toContain(`g('${campo}')`);
    }
  });

  it('e o formulário servido tem um campo para cada uma delas', async () => {
    const { publicSite } = await import('../server/public/router');

    const res = await publicSite.fetch(new Request('http://local/checkout?curso=formacao-teste'));
    expect(res.status).toBe(200);
    const html = await res.text();

    for (const campo of [
      'name',
      'email',
      'birthDate',
      'cep',
      'logradouro',
      'numero',
      'bairro',
      'cidade',
      'uf',
      'consent',
    ]) {
      expect(html, `falta o campo "${campo}" no formulário`).toContain(`name="${campo}"`);
    }
  });
});
