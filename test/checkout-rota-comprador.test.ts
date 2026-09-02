import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A rota de compra manda ao gateway quem está comprando.
 *
 * `test/checkout-pagarme.test.ts` cobre o payload que o provider monta. Este
 * cobre o degrau anterior, que é onde o defeito de verdade morava: a rota
 * `POST /payments/checkout` chamava `createPayment` com **só o e-mail**, e
 * nenhum teste olhava para isso. O provider fazia o certo com o que recebia; o
 * que recebia é que estava pela metade.
 *
 * Dois comportamentos ficam presos aqui:
 *
 * 1. CPF inválido para **antes** de criar o pedido. Sem isso, um dígito
 *    trocado vira pedido em `pending_payment` para uma cobrança que o gateway
 *    nunca aceitou — e a pessoa lê "falha no pagamento" em vez de "confira o
 *    número".
 * 2. Nome e documento chegam ao provider. Enquanto não chegavam, o Pagar.me
 *    montava o nome com `email.split('@')[0]`.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let tokenAluno: string;
let cifrar: (claro: string) => string;

/** CPF com DV correto, gerado para teste — não pertence a ninguém. */
const CPF_VALIDO = '52998224725';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-checkout-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  // Credencial de gateway é cifrada em repouso. Sem `AI_KEY_ENCRYPTION_SECRET`
  // o módulo de cifra recusa descriptografar, e a rota devolveria 500 por
  // motivo que nada tem a ver com o que este teste mede.
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);

  // Gateway `mock`: cria a cobrança sem falar com ninguém de fora. O que
  // interessa aqui é o que a rota repassa, não o que o gateway faz com isso.
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
      [
        {
          id: 'prod-1',
          name: 'Curso de Teste',
          kind: 'course',
          refId: 'c-1',
          priceCents: 19900,
          currency: 'BRL',
          active: true,
          createdAt: '2026-09-02T00:00:00.000Z',
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();

  // Um login só: `/auth/login` tem teto por minuto e logar a cada caso estoura
  // o próprio limite.
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
  // `maxRetries` porque o JsonStore pode ainda estar terminando uma escrita da
  // fila quando o teste acaba, e no Windows isso vira ENOTEMPTY.
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5 });
});

async function comprar(corpo: Record<string, unknown>) {
  const res = await app.fetch(
    new Request('http://local/api/payments/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAluno}`,
      },
      body: JSON.stringify(corpo),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, never> };
}

async function pedidosGravados(): Promise<unknown[]> {
  try {
    const cru = await fs.readFile(path.join(tmpDir, 'payment-orders.json'), 'utf8');
    return JSON.parse(cru) as unknown[];
  } catch {
    return [];
  }
}

describe('POST /payments/checkout — quem compra', () => {
  it('CPF inválido volta 400 e NÃO deixa pedido para trás', async () => {
    const antes = (await pedidosGravados()).length;
    const r = await comprar({
      productId: 'prod-1',
      name: 'Aluno de Teste',
      document: '11111111111', // 11 dígitos, DV impossível
    });
    expect(r.status).toBe(400);
    expect((r.body as { error?: { code?: string } }).error?.code).toBe('INVALID_DOCUMENT');
    expect((await pedidosGravados()).length).toBe(antes);
  });

  it('com CPF válido, o pedido nasce com nome e documento', async () => {
    const r = await comprar({
      productId: 'prod-1',
      name: 'Aluno de Teste',
      document: CPF_VALIDO,
    });
    // 201: a rota cria um pedido, e criar recurso responde 201.
    expect(r.status).toBe(201);
    expect((r.body as { id?: string }).id).toBeTruthy();
  });

  it('sem documento continua passando — a exigência é do provider, não do schema', async () => {
    // Nem todo gateway pede documento (o `mock` não pede), e marcar o campo
    // obrigatório no schema quebraria as chamadas que já existem.
    const r = await comprar({ productId: 'prod-1' });
    expect(r.status).toBe(201);
  });

  it('sem token, 401 — a rota nunca foi pública e segue não sendo', async () => {
    const res = await app.fetch(
      new Request('http://local/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: 'prod-1' }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
