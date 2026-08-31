import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Carrinho: vários cursos, um pagamento só.
 *
 * O pedido tem UM produto (`productId` é coluna, não tabela de itens). Em vez
 * de mexer na tabela do dinheiro, o servidor materializa um produto
 * `kind: 'bundle'` inativo com os `courseIds` do carrinho — e
 * `grantAccessForOrder` já sabe matricular em todos os cursos de um pacote.
 *
 * A propriedade central que estes testes cobram é de segurança, não de
 * funcionalidade: **o preço nunca vem do cliente**. O carrinho vive no
 * localStorage do navegador, então o corpo da requisição é palpite — e pode ser
 * palpite malicioso. O corpo escolhe QUAIS cursos; quanto custam é decisão do
 * servidor.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

const PRECO_A = 49900;
const PRECO_B = 30000;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-carrinho-'));
  process.env.DATA_DIR = tmpDir;

  const curso = (id: string, slug: string, title: string) => ({
    id,
    slug,
    title,
    shortTitle: title,
    description: title,
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 8,
    certificateAvailable: true,
    tags: [],
    modules: [],
  });

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [
        curso('c-a', 'curso-a', 'Curso A'),
        curso('c-b', 'curso-b', 'Curso B'),
        // Fora da vitrine: não pode ser comprado nem por quem sabe o slug.
        { ...curso('c-oculto', 'curso-oculto', 'Curso Oculto'), publicListed: false },
        // Sem produto ativo: existe, mas não está à venda.
        curso('c-sem-preco', 'curso-sem-preco', 'Curso Sem Preço'),
      ],
      null,
      2,
    ),
    'utf8',
  );

  const agora = new Date().toISOString();
  const produto = (id: string, refId: string, priceCents: number) => ({
    id,
    name: refId,
    kind: 'course',
    refId,
    priceCents,
    currency: 'BRL',
    active: true,
    createdAt: agora,
    updatedAt: agora,
  });

  await fs.writeFile(
    path.join(tmpDir, 'payment-products.json'),
    JSON.stringify([produto('p-a', 'c-a', PRECO_A), produto('p-b', 'c-b', PRECO_B)], null, 2),
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

/**
 * Cada compra vem de um IP diferente — que é o caso real, e é o que evita que
 * a suíte esbarre no limitador (8 por minuto por IP+rota).
 */
let visitante = 0;
async function comprar(corpo: Record<string, unknown>) {
  visitante += 1;
  const res = await app.fetch(
    new Request('http://local/api/public/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `203.0.113.${visitante}`,
      },
      body: JSON.stringify({
        name: 'Fulano de Tal',
        email: `c${Math.random().toString(36).slice(2)}@exemplo.test`,
        consent: true,
        ...corpo,
      }),
    }),
  );
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function pedidos(): Promise<Array<Record<string, unknown>>> {
  const bruto = await fs.readFile(path.join(tmpDir, 'payment-orders.json'), 'utf8');
  return JSON.parse(bruto);
}

async function produtos(): Promise<Array<Record<string, unknown>>> {
  const bruto = await fs.readFile(path.join(tmpDir, 'payment-products.json'), 'utf8');
  return JSON.parse(bruto);
}

describe('checkout com carrinho', () => {
  it('soma o preço no servidor — o que o cliente manda não conta', async () => {
    const r = await comprar({
      courseSlugs: ['curso-a', 'curso-b'],
      // Um cliente malicioso mandando preço junto não muda nada: o servidor
      // nem olha para estes campos.
      priceCents: 1,
      total: 1,
      amountCents: 1,
    });
    expect(r.status).toBe(201);

    const ordem = (await pedidos()).find((o) => o.id === r.json.orderId)!;
    expect(ordem.amountCents).toBe(PRECO_A + PRECO_B);
    expect((ordem.productSnapshot as Record<string, unknown>).priceCents).toBe(PRECO_A + PRECO_B);
  });

  it('cria o pacote como inativo, para não virar oferta no catálogo', async () => {
    const r = await comprar({ courseSlugs: ['curso-a', 'curso-b'] });
    expect(r.status).toBe(201);

    const ordem = (await pedidos()).find((o) => o.id === r.json.orderId)!;
    const pacote = (await produtos()).find((p) => p.id === ordem.productId)!;

    expect(pacote.kind).toBe('bundle');
    // Se ficar ativo, o carrinho de um comprador aparece na vitrine de todos.
    expect(pacote.active).toBe(false);
    const meta = pacote.metadata as Record<string, unknown>;
    expect(meta.adhoc).toBe(true);
    // É por aqui que grantAccessForOrder matricula em todos os cursos.
    expect(meta.courseIds).toEqual(['c-a', 'c-b']);
  });

  it('curso repetido não vira cobrança dobrada', async () => {
    const r = await comprar({ courseSlugs: ['curso-a', 'curso-a', 'curso-a'] });
    expect(r.status).toBe(201);

    const ordem = (await pedidos()).find((o) => o.id === r.json.orderId)!;
    // Um curso só sobrou: some a duplicata e o pedido volta a ser simples,
    // com o produto original — não um pacote de um item.
    expect(ordem.amountCents).toBe(PRECO_A);
    expect(ordem.productId).toBe('p-a');
  });

  it('um curso só continua funcionando como antes', async () => {
    const r = await comprar({ courseSlug: 'curso-a' });
    expect(r.status).toBe(201);
    const ordem = (await pedidos()).find((o) => o.id === r.json.orderId)!;
    expect(ordem.productId).toBe('p-a');
    expect(ordem.amountCents).toBe(PRECO_A);
  });

  it('curso fora da vitrine não entra no carrinho', async () => {
    const r = await comprar({ courseSlugs: ['curso-a', 'curso-oculto'] });
    expect(r.status).toBe(404);
  });

  it('curso sem produto ativo recusa o carrinho inteiro, dizendo qual', async () => {
    const r = await comprar({ courseSlugs: ['curso-a', 'curso-sem-preco'] });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.json)).toContain('Curso Sem Preço');
  });

  it('exige pelo menos um curso', async () => {
    const r = await comprar({});
    expect(r.status).toBe(400);
  });
});
