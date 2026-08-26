/**
 * Cupons de desconto.
 *
 * Dois backends, como o resto da casa: tabela `payment_coupons` com
 * `DATABASE_URL`, `data/payment-coupons.json` sem ela. Mesmo molde de
 * `courses.ts` — lê do banco e cai no JSON quando a tabela está vazia.
 *
 * `validateCoupon` continua sendo função pura sobre um cupom já carregado: a
 * regra de validade não muda com o backend, e é ela que decide dinheiro.
 */

import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';

export type CouponDiscount =
  | { kind: 'percent'; value: number /* 0-100 */ }
  | { kind: 'amount'; value: number /* cents */ };

export interface Coupon {
  id: string;
  code: string; // único, uppercase
  description?: string;
  discount: CouponDiscount;
  // Aplica só a esses productIds; se vazio, aplica a todos
  appliesToProductIds: string[];
  maxUses: number | null; // null = ilimitado
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<Coupon>('payment-coupons.json', () => []);

function daLinha(r: typeof schema.paymentCoupons.$inferSelect): Coupon {
  return {
    id: r.id,
    code: r.code,
    description: r.description,
    discount: r.discount as CouponDiscount,
    appliesToProductIds: r.appliesToProductIds ?? [],
    maxUses: r.maxUses ?? null,
    usedCount: r.usedCount,
    validFrom: r.validFrom ?? null,
    validUntil: r.validUntil ?? null,
    active: r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function newId(): string {
  return `coup-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<Coupon[]> {
  const db = getDb();
  if (db) {
    const rows = await db.select().from(schema.paymentCoupons);
    if (rows.length > 0) return rows.map(daLinha);
  }
  return await store.getAll();
}

export async function findByCode(code: string): Promise<Coupon | null> {
  const alvo = code.trim().toUpperCase();
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentCoupons)
      .where(eq(schema.paymentCoupons.code, alvo));
    if (rows[0]) return daLinha(rows[0]);
  }
  return await store.findOne((c) => c.code === alvo);
}

export async function findById(id: string): Promise<Coupon | null> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(schema.paymentCoupons)
      .where(eq(schema.paymentCoupons.id, id));
    if (rows[0]) return daLinha(rows[0]);
  }
  return await store.findOne((c) => c.id === id);
}

interface CreateInput {
  code: string;
  description?: string;
  discount: CouponDiscount;
  appliesToProductIds?: string[];
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
}

export async function createCoupon(input: CreateInput): Promise<Coupon> {
  const now = new Date().toISOString();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
    throw new Error('Código inválido. Use letras/números/_-, 2 a 40 chars.');
  }
  const existing = await findByCode(code);
  if (existing) throw new Error('Já existe cupom com esse código.');
  const c: Coupon = {
    id: newId(),
    code,
    description: input.description,
    discount: input.discount,
    appliesToProductIds: input.appliesToProductIds ?? [],
    maxUses: input.maxUses ?? null,
    usedCount: 0,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  const db = getDb();
  if (db) {
    await db.insert(schema.paymentCoupons).values({
      ...c,
      description: c.description ?? '',
      discount: c.discount,
    });
    return c;
  }
  await store.unshift(c);
  return c;
}

export async function updateCoupon(id: string, patch: Partial<CreateInput>): Promise<Coupon | null> {
  const db = getDb();
  if (db) {
    const campos: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (patch.description !== undefined) campos.description = patch.description;
    if (patch.discount !== undefined) campos.discount = patch.discount;
    if (patch.appliesToProductIds !== undefined)
      campos.appliesToProductIds = patch.appliesToProductIds;
    if (patch.maxUses !== undefined) campos.maxUses = patch.maxUses;
    if (patch.validFrom !== undefined) campos.validFrom = patch.validFrom;
    if (patch.validUntil !== undefined) campos.validUntil = patch.validUntil;
    if (patch.active !== undefined) campos.active = patch.active;
    const rows = await db
      .update(schema.paymentCoupons)
      .set(campos)
      .where(eq(schema.paymentCoupons.id, id))
      .returning();
    return rows[0] ? daLinha(rows[0]) : null;
  }
  return await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.discount !== undefined ? { discount: patch.discount } : {}),
      ...(patch.appliesToProductIds !== undefined
        ? { appliesToProductIds: patch.appliesToProductIds }
        : {}),
      ...(patch.maxUses !== undefined ? { maxUses: patch.maxUses } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validUntil !== undefined ? { validUntil: patch.validUntil } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function deleteCoupon(id: string): Promise<boolean> {
  const db = getDb();
  if (db) {
    const rows = await db
      .delete(schema.paymentCoupons)
      .where(eq(schema.paymentCoupons.id, id))
      .returning();
    return rows.length > 0;
  }
  return await store.remove((c) => c.id === id);
}

/**
 * Valida cupom para um produto. Retorna desconto aplicável ou erro.
 */
export function validateCoupon(
  coupon: Coupon | null,
  productId: string,
  amountCents: number,
): { ok: true; discountCents: number } | { ok: false; reason: string } {
  if (!coupon) return { ok: false, reason: 'Cupom não encontrado.' };
  if (!coupon.active) return { ok: false, reason: 'Cupom inativo.' };
  const now = Date.now();
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
    return { ok: false, reason: 'Cupom ainda não está válido.' };
  }
  if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now) {
    return { ok: false, reason: 'Cupom expirado.' };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: 'Cupom esgotado.' };
  }
  if (
    coupon.appliesToProductIds.length > 0 &&
    !coupon.appliesToProductIds.includes(productId)
  ) {
    return { ok: false, reason: 'Cupom não vale para este produto.' };
  }
  let discountCents: number;
  if (coupon.discount.kind === 'percent') {
    discountCents = Math.floor((amountCents * coupon.discount.value) / 100);
  } else {
    discountCents = Math.min(coupon.discount.value, amountCents);
  }
  if (discountCents > amountCents) discountCents = amountCents;
  return { ok: true, discountCents };
}

export async function incrementUsage(id: string): Promise<void> {
  const db = getDb();
  if (db) {
    // Incremento no próprio SQL, e não ler-somar-gravar: duas compras
    // simultâneas com o mesmo cupom perderiam um uso na segunda forma, e o
    // limite de usos existe justamente para ser respeitado sob concorrência.
    await db
      .update(schema.paymentCoupons)
      .set({
        usedCount: sql`${schema.paymentCoupons.usedCount} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.paymentCoupons.id, id));
    return;
  }
  await store.update(
    (c) => c.id === id,
    (c) => ({ ...c, usedCount: c.usedCount + 1, updatedAt: new Date().toISOString() }),
  );
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0,O,1,I — clareza visual

/** Gera código aleatório com `length` chars do alfabeto sem ambigüidade. */
export function generateRandomCode(length: number): string {
  const buf = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHA[buf[i]! % ALPHA.length];
  }
  return out;
}

export interface BulkCreateInput {
  // Se prefix definido + sequencial, gera PREFIX01, PREFIX02, ...
  // Senão, gera códigos aleatórios.
  count: number;
  prefix?: string;
  sequential?: boolean;
  randomLength?: number; // default 8
  description?: string;
  discount: CouponDiscount;
  appliesToProductIds?: string[];
  maxUsesPerCoupon?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

export async function createCouponsBulk(
  input: BulkCreateInput,
): Promise<{ created: Coupon[]; skipped: string[] }> {
  if (input.count < 1 || input.count > 1000) {
    throw new Error('count deve ser entre 1 e 1000.');
  }
  const length = input.randomLength ?? 8;
  if (length < 4 || length > 20) {
    throw new Error('randomLength deve ser entre 4 e 20.');
  }
  const created: Coupon[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < input.count; i++) {
    let code: string;
    if (input.prefix && input.sequential) {
      const seq = (i + 1).toString().padStart(2, '0');
      code = `${input.prefix.toUpperCase()}${seq}`;
    } else if (input.prefix) {
      code = `${input.prefix.toUpperCase()}${generateRandomCode(length)}`;
    } else {
      code = generateRandomCode(length);
    }
    try {
      const c = await createCoupon({
        code,
        description: input.description,
        discount: input.discount,
        appliesToProductIds: input.appliesToProductIds,
        maxUses: input.maxUsesPerCoupon ?? null,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        active: true,
      });
      created.push(c);
    } catch {
      skipped.push(code);
    }
  }

  return { created, skipped };
}

/** CSV simples com header + rows. Coluna code, discount, valid_until, max_uses, used_count. */
export async function exportCouponsAsCsv(): Promise<string> {
  const all = await store.getAll();
  const rows: string[] = [];
  rows.push('code,description,discount_kind,discount_value,valid_from,valid_until,max_uses,used_count,active');
  for (const c of all) {
    const cells = [
      c.code,
      (c.description ?? '').replace(/[",\n]/g, ' '),
      c.discount.kind,
      String(c.discount.value),
      c.validFrom ?? '',
      c.validUntil ?? '',
      c.maxUses === null ? '' : String(c.maxUses),
      String(c.usedCount),
      c.active ? '1' : '0',
    ];
    rows.push(cells.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
  }
  return rows.join('\n');
}
