// Cupons de desconto — data/payment-coupons.json.

import crypto from 'node:crypto';
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

function newId(): string {
  return `coup-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<Coupon[]> {
  return await store.getAll();
}

export async function findByCode(code: string): Promise<Coupon | null> {
  return await store.findOne((c) => c.code === code.trim().toUpperCase());
}

export async function findById(id: string): Promise<Coupon | null> {
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
  await store.unshift(c);
  return c;
}

export async function updateCoupon(id: string, patch: Partial<CreateInput>): Promise<Coupon | null> {
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
  await store.update(
    (c) => c.id === id,
    (c) => ({ ...c, usedCount: c.usedCount + 1, updatedAt: new Date().toISOString() }),
  );
}
