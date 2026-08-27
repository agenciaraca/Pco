import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A aba "Integrações" das configurações mostrava cinco nomes com o selo "não
 * conectado" escrito à mão no `.tsx`, mais a frase "Atualmente nenhum provedor
 * terceiro está conectado". Dizia isso mesmo com um gateway Stripe ativo
 * processando pagamento e com um provedor de e-mail configurado e testado.
 *
 * O que estes testes cobram é a distinção que a lista antiga não fazia:
 * conectado ≠ falta configurar ≠ não existe.
 */

let tmpDir: string;
let integracoes: typeof import('../server/health/integracoes');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-integr-'));
  process.env.DATA_DIR = tmpDir;
  integracoes = await import('../server/health/integracoes');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('status das integrações', () => {
  it('toda linha diz o que está ligado ou o que falta', async () => {
    const lista = await integracoes.listarIntegracoes();
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((i) => i.detalhe.trim().length > 0)).toBe(true);
    expect(lista.every((i) => i.nome && i.categoria && i.id)).toBe(true);
  });

  it('sem nada configurado, os provedores aparecem como "falta configurar"', async () => {
    const lista = await integracoes.listarIntegracoes();
    for (const id of ['pagamentos', 'email', 'ia', 'webhooks', 'zoom']) {
      expect(lista.find((i) => i.id === id)?.estado).toBe('disponivel');
    }
  });

  it('o que não existe no código é marcado como inexistente, não como desconectado', async () => {
    const lista = await integracoes.listarIntegracoes();
    // A lista antiga oferecia estes dois como se bastasse ir lá conectar.
    expect(lista.find((i) => i.id === 'google-calendar')?.estado).toBe('inexistente');
    expect(lista.find((i) => i.id === 'google-analytics')?.estado).toBe('inexistente');
  });

  it('a medição de tráfego aparece conectada — ela é própria e não depende de ninguém', async () => {
    const lista = await integracoes.listarIntegracoes();
    expect(lista.find((i) => i.id === 'analytics')?.estado).toBe('conectado');
  });

  it('o Search Console segue faltando, e diz para quê', async () => {
    const lista = await integracoes.listarIntegracoes();
    const sc = lista.find((i) => i.id === 'search-console');
    expect(sc?.estado).toBe('disponivel');
    expect(sc?.detalhe).toMatch(/posição em busca/i);
  });

  it('quem falta configurar aponta onde se configura', async () => {
    const lista = await integracoes.listarIntegracoes();
    const faltando = lista.filter((i) => i.estado === 'disponivel' && i.id !== 'search-console');
    expect(faltando.length).toBeGreaterThan(0);
    expect(faltando.every((i) => (i.ondeConfigurar ?? '').startsWith('/admin/'))).toBe(true);
  });
});

describe('gateway de teste não conta como conectado', () => {
  it('só o mock ativo continua sendo "falta configurar"', async () => {
    // Escrever direto no store é o caminho: o repositório criptografa chaves,
    // e o que este teste mede é a classificação, não a criptografia.
    await fs.writeFile(
      path.join(tmpDir, 'payment-gateways.json'),
      JSON.stringify(
        [
          {
            id: 'gw-mock',
            provider: 'mock',
            label: 'Teste',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        null,
        2,
      ),
      'utf8',
    );
    // O JsonStore guarda os itens em memória por instância de módulo, e a
    // instância vive no repositório. Sem zerar o grafo, este caso leria o
    // estado carregado pelos anteriores.
    vi.resetModules();
    const fresco = await import('../server/health/integracoes');
    const lista = await fresco.listarIntegracoes();
    const pg = lista.find((i) => i.id === 'pagamentos');
    // Mock ativo é dinheiro nenhum entrando — dizer "conectado" esconderia isso.
    expect(pg?.estado).toBe('disponivel');
    // E o detalhe precisa provar que o mock FOI lido: sem esta linha o caso
    // passaria também com zero gateways, que é o mesmo veredito por outro
    // motivo — teste que não sabe distinguir os dois não testa nada.
    expect(pg?.detalhe).toMatch(/mock/i);
  });
});
