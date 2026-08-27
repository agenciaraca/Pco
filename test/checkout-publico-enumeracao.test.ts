import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O checkout público não pode dizer quem já é aluno.
 *
 * `POST /public/checkout` devolvia `isNewAccount` até 27/ago/2026 — e ninguém
 * consumia: o script do site público lê só `checkoutUrl`. O que o campo fazia
 * era responder, numa rota aberta, se um e-mail tem conta na escola.
 *
 * Numa escola de psicanálise isso não é trivia: saber que fulano estuda aqui é
 * informação sobre a vida dele.
 *
 * A propriedade que estes testes cobram é mais forte que "o campo sumiu": a
 * resposta para um e-mail conhecido e para um desconhecido precisa ser
 * **indistinguível**.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

const CONHECIDO = 'aluno@pco.local';
const DESCONHECIDO = 'ninguem-nunca-visto@exemplo.test';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-checkout-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.NODE_ENV_ORIGINAL;

  const curso = {
    id: 'c-venda',
    slug: 'curso-a-venda',
    title: 'Curso à Venda',
    shortTitle: 'À Venda',
    description: 'Curso publicado',
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 8,
    certificateAvailable: true,
    tags: [],
    modules: [],
  };
  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify([curso], null, 2),
    'utf8',
  );

  const agora = new Date().toISOString();
  await fs.writeFile(
    path.join(tmpDir, 'payment-products.json'),
    JSON.stringify(
      [
        {
          id: 'prod-venda',
          name: 'Curso à Venda',
          kind: 'course',
          refId: 'c-venda',
          priceCents: 49900,
          currency: 'BRL',
          active: true,
          createdAt: agora,
          updatedAt: agora,
        },
      ],
      null,
      2,
    ),
    'utf8',
  );
  await fs.writeFile(
    path.join(tmpDir, 'payment-gateways.json'),
    JSON.stringify(
      [
        {
          id: 'gw-mock',
          provider: 'mock',
          label: 'Sandbox',
          mode: 'test',
          active: true,
          createdAt: agora,
          updatedAt: agora,
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function comprar(email: string): Promise<{ status: number; corpo: string }> {
  const res = await app.fetch(
    new Request('http://local/api/public/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSlug: 'curso-a-venda',
        name: 'Fulano de Tal',
        email,
        consent: true,
      }),
    }),
  );
  return { status: res.status, corpo: await res.text() };
}

describe('checkout público', () => {
  it('não devolve se o e-mail já tinha conta', async () => {
    const r = await comprar(DESCONHECIDO);
    expect(r.corpo).not.toContain('isNewAccount');
  });

  it('e-mail conhecido e desconhecido são indistinguíveis na resposta', async () => {
    const conhecido = await comprar(CONHECIDO);
    const desconhecido = await comprar(DESCONHECIDO);

    expect(conhecido.status).toBe(desconhecido.status);

    // As chaves precisam ser as mesmas; os valores diferem porque cada pedido
    // é um pedido — o que não pode diferir é a *forma* da resposta.
    const chaves = (s: string) => Object.keys(JSON.parse(s) as object).sort();
    expect(chaves(conhecido.corpo)).toEqual(chaves(desconhecido.corpo));
  });

  it('o que a tela precisa continua vindo', async () => {
    const r = await comprar(DESCONHECIDO);
    const j = JSON.parse(r.corpo) as { checkoutUrl?: string; orderId?: string };
    expect(j.checkoutUrl, 'sem checkoutUrl o botão de comprar não leva a lugar nenhum').toBeTruthy();
    expect(j.orderId).toBeTruthy();
  });
});
