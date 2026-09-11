import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * `POST /payments/checkout` (aluno já logado, comprando um segundo curso) até
 * 11/set/2026 não tinha `origem` no schema nem passava `attribution` para
 * `createOrder` — só o checkout PÚBLICO capturava `gclid`. Medido em
 * produção no mesmo dia: dos pedidos pagos dos últimos 90 dias, 23 de 27
 * tinham alguma atribuição, mas só 1 tinha `gclid` — o gargalo real não era
 * "poucos cliques vieram do Google", era esta rota nunca ter chance de
 * carregar o dado, mesmo quando ele existia no `localStorage` de quem
 * comprou.
 *
 * Achado na mesma auditoria de varredura que fechou a transcrição e a
 * biblioteca (ver os dois arquivos irmãos deste).
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let tokenAluno: string;
let cifrar: (claro: string) => string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-checkout-origem-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);

  ({ encryptApiKey: cifrar } = await import('../server/db/encryption'));

  await fs.writeFile(
    path.join(tmpDir, 'payment-gateways.json'),
    JSON.stringify(
      [
        {
          id: 'gw-mock',
          provider: 'mock',
          displayName: 'Mock',
          mode: 'test',
          active: true,
          apiKey: cifrar('chave-de-teste'),
          options: {},
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      ],
      null,
      2,
    ),
    'utf8',
  );
  await fs.writeFile(
    path.join(tmpDir, 'payment-products.json'),
    JSON.stringify(
      // Um produto por caso, de propósito: `acharPendenteEquivalente` reusa
      // pedido pendente do MESMO produto por 10 minutos, e os três casos
      // deste arquivo rodam em milissegundos — com um produto só, o segundo
      // e o terceiro `comprar()` devolveriam o pedido do primeiro, em vez de
      // criar um novo, e a comparação de atribuição mediria o pedido errado.
      ['prod-1', 'prod-2', 'prod-3', 'prod-4'].map((id, i) => ({
        id,
        name: `Curso de Teste ${i + 1}`,
        kind: 'course',
        refId: `c-${i + 1}`,
        priceCents: 19900,
        currency: 'BRL',
        active: true,
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      })),
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();

  const res = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aluno@pco.local', password: 'TesteAluno!2026' }),
    }),
  );
  if (res.status !== 200) throw new Error(`login falhou: ${res.status}`);
  tokenAluno = ((await res.json()) as { token: string }).token;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5 });
});

async function comprar(corpo: Record<string, unknown>) {
  const res = await app.fetch(
    new Request('http://local/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAluno}` },
      body: JSON.stringify(corpo),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function pedidosGravados(): Promise<Array<Record<string, unknown>>> {
  const cru = await fs.readFile(path.join(tmpDir, 'payment-orders.json'), 'utf8');
  return JSON.parse(cru) as Array<Record<string, unknown>>;
}

describe('checkout do aluno logado captura gclid (não só o público)', () => {
  it('o pedido nasce com attribution.gclid quando `origem` vem no corpo', async () => {
    const r = await comprar({
      productId: 'prod-1',
      origem: { gclid: 'gclid-teste-12345', utm_source: 'google', utm_campaign: 'PerformancePCO' },
    });
    expect(r.status).toBe(201);

    const pedidos = await pedidosGravados();
    const pedido = pedidos.find((p) => p.id === r.body.id);
    expect(pedido).toBeTruthy();
    const attribution = pedido!.attribution as { gclid?: string; campanha?: string } | null;
    expect(attribution?.gclid).toBe('gclid-teste-12345');
    expect(attribution?.campanha).toBe('PerformancePCO');
  });

  it('sem `origem` no corpo, attribution continua null — não inventa dado', async () => {
    const r = await comprar({ productId: 'prod-2' });
    expect(r.status).toBe(201);
    const pedidos = await pedidosGravados();
    const pedido = pedidos.find((p) => p.id === r.body.id);
    expect(pedido!.attribution).toBeNull();
  });

  it('`origem` não decide nada da compra — mesmo preço, com ou sem gclid', async () => {
    const semOrigem = await comprar({ productId: 'prod-3' });
    const comOrigem = await comprar({ productId: 'prod-4', origem: { gclid: 'x' } });
    expect(semOrigem.status).toBe(201);
    expect(comOrigem.status).toBe(201);
  });
});
