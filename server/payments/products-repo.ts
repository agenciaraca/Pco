/**
 * Repository de produtos (cursos/sessões/pacotes à venda).
 *
 * Dois backends, como o resto da casa: com a tabela `payment_products`
 * disponível, lê e escreve nela; sem ela, cai no JSON de sempre. O caminho JSON
 * não foi apagado — é o que faz o dev local rodar sem banco, e é a rede de
 * proteção quando a migração ainda não passou no servidor.
 *
 * Por que valia migrar (31/ago/2026): **produto é o preço**. Até esta data
 * nenhum curso tinha preço e o checkout recusava tudo; no momento em que os
 * preços entraram, `data/payment-products.json` passou a ser o arquivo que
 * decide quanto o aluno paga — fora do backup transacional, fora de qualquer
 * consulta, e sujeito a se perder junto com o disco. É o mesmo raciocínio que
 * levou os pedidos para o banco em 26/ago.
 */

import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema } from '../db/client';
import { bancoSeTabelaExiste } from '../db/tabela-ausente';
import { JsonStore } from '../db/json-store';
import type { Product } from './types';

const store = new JsonStore<Product>('payment-products.json', () => []);

type Linha = typeof schema.paymentProducts.$inferSelect;

function daLinha(r: Linha): Product {
  return {
    id: r.id,
    kind: r.kind as Product['kind'],
    refId: r.refId ?? null,
    name: r.name,
    description: r.description ?? undefined,
    priceCents: r.priceCents,
    currency: r.currency,
    active: r.active,
    metadata: (r.metadata ?? undefined) as Product['metadata'],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function newId(): string {
  return `prod-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

async function banco() {
  return await bancoSeTabelaExiste('payment_products');
}

export async function listAll(): Promise<Product[]> {
  const db = await banco();
  if (!db) return await store.getAll();
  const linhas = await db.select().from(schema.paymentProducts);
  return linhas.map(daLinha);
}

export async function listActive(): Promise<Product[]> {
  const db = await banco();
  if (!db) return await store.filter((p) => p.active);
  const linhas = await db
    .select()
    .from(schema.paymentProducts)
    .where(eq(schema.paymentProducts.active, true));
  return linhas.map(daLinha);
}

export async function findById(id: string): Promise<Product | null> {
  const db = await banco();
  if (!db) return await store.findOne((p) => p.id === id);
  const linhas = await db
    .select()
    .from(schema.paymentProducts)
    .where(eq(schema.paymentProducts.id, id));
  return linhas[0] ? daLinha(linhas[0]) : null;
}

export async function findByCourseId(courseId: string): Promise<Product | null> {
  const db = await banco();
  if (!db) {
    return await store.findOne((p) => p.kind === 'course' && p.refId === courseId && p.active);
  }
  const linhas = await db
    .select()
    .from(schema.paymentProducts)
    .where(
      and(
        eq(schema.paymentProducts.kind, 'course'),
        eq(schema.paymentProducts.refId, courseId),
        eq(schema.paymentProducts.active, true),
      ),
    );
  return linhas[0] ? daLinha(linhas[0]) : null;
}

interface CreateInput {
  kind: Product['kind'];
  refId?: string | null;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function createProduct(input: CreateInput): Promise<Product> {
  const now = new Date().toISOString();
  const p: Product = {
    id: newId(),
    kind: input.kind,
    refId: input.refId ?? null,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    currency: input.currency ?? 'BRL',
    active: input.active ?? true,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };
  const db = await banco();
  if (!db) {
    await store.unshift(p);
    return p;
  }
  await db.insert(schema.paymentProducts).values({
    id: p.id,
    kind: p.kind,
    refId: p.refId,
    name: p.name,
    description: p.description ?? null,
    priceCents: p.priceCents,
    currency: p.currency,
    active: p.active,
    metadata: p.metadata ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
  return p;
}

interface UpdateInput {
  kind?: Product['kind'];
  refId?: string | null;
  name?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function updateProduct(id: string, patch: UpdateInput): Promise<Product | null> {
  const db = await banco();
  if (!db) {
    return await store.update(
      (p) => p.id === id,
      (p) => ({
        ...p,
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.refId !== undefined ? { refId: patch.refId } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  const campos: Partial<typeof schema.paymentProducts.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.kind !== undefined) campos.kind = patch.kind;
  if (patch.refId !== undefined) campos.refId = patch.refId;
  if (patch.name !== undefined) campos.name = patch.name;
  if (patch.description !== undefined) campos.description = patch.description;
  if (patch.priceCents !== undefined) campos.priceCents = patch.priceCents;
  if (patch.currency !== undefined) campos.currency = patch.currency;
  if (patch.active !== undefined) campos.active = patch.active;
  if (patch.metadata !== undefined) campos.metadata = patch.metadata;

  await db.update(schema.paymentProducts).set(campos).where(eq(schema.paymentProducts.id, id));
  return await findById(id);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = await banco();
  if (!db) return await store.remove((p) => p.id === id);
  const antes = await findById(id);
  if (!antes) return false;
  await db.delete(schema.paymentProducts).where(eq(schema.paymentProducts.id, id));
  return true;
}

/**
 * Leva os produtos do JSON para a tabela. Idempotente: pula o que já existe,
 * comparando por id.
 *
 * Existe como função, e não só como script, porque quem precisa disso é o dono —
 * e ele não tem shell. Não apaga o JSON: se algo der errado no meio, a origem
 * continua intacta e a chamada pode ser repetida.
 */
export async function migrarJsonParaBanco(): Promise<{
  noJson: number;
  jaNoBanco: number;
  migrados: number;
}> {
  const db = await banco();
  if (!db) return { noJson: 0, jaNoBanco: 0, migrados: 0 };

  const doJson = await store.getAll();
  const noBanco = await db.select({ id: schema.paymentProducts.id }).from(schema.paymentProducts);
  const existentes = new Set(noBanco.map((r) => r.id));

  let migrados = 0;
  for (const p of doJson) {
    if (existentes.has(p.id)) continue;
    await db.insert(schema.paymentProducts).values({
      id: p.id,
      kind: p.kind,
      refId: p.refId ?? null,
      name: p.name,
      description: p.description ?? null,
      priceCents: p.priceCents,
      currency: p.currency,
      active: p.active,
      metadata: p.metadata ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
    migrados++;
  }
  return { noJson: doJson.length, jaNoBanco: existentes.size, migrados };
}
