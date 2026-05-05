import { describe, it, expect } from 'vitest';
import {
  validateCoupon,
  generateRandomCode,
} from '../server/payments/coupons-repo';
import type { Coupon } from '../server/payments/coupons-repo';

const baseCoupon: Coupon = {
  id: 'coup-1',
  code: 'TEST10',
  description: 'Teste',
  discount: { kind: 'percent', value: 10 },
  appliesToProductIds: [],
  maxUses: null,
  usedCount: 0,
  validFrom: null,
  validUntil: null,
  active: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('validateCoupon', () => {
  it('aplica desconto percentual', () => {
    const r = validateCoupon(baseCoupon, 'p1', 10000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(1000);
  });

  it('aplica desconto fixo', () => {
    const c: Coupon = {
      ...baseCoupon,
      discount: { kind: 'amount', value: 500 },
    };
    const r = validateCoupon(c, 'p1', 10000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(500);
  });

  it('limita desconto fixo ao valor da compra', () => {
    const c: Coupon = {
      ...baseCoupon,
      discount: { kind: 'amount', value: 99999 },
    };
    const r = validateCoupon(c, 'p1', 5000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(5000);
  });

  it('rejeita cupom inativo', () => {
    const r = validateCoupon({ ...baseCoupon, active: false }, 'p1', 10000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('inativo');
  });

  it('rejeita cupom expirado', () => {
    const r = validateCoupon(
      { ...baseCoupon, validUntil: '2020-01-01T00:00:00Z' },
      'p1',
      10000,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('expirado');
  });

  it('rejeita cupom ainda não válido', () => {
    const r = validateCoupon(
      { ...baseCoupon, validFrom: '2099-01-01T00:00:00Z' },
      'p1',
      10000,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('ainda não');
  });

  it('rejeita cupom esgotado', () => {
    const r = validateCoupon(
      { ...baseCoupon, maxUses: 5, usedCount: 5 },
      'p1',
      10000,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('esgotado');
  });

  it('rejeita cupom não aplicável ao produto', () => {
    const r = validateCoupon(
      { ...baseCoupon, appliesToProductIds: ['p2', 'p3'] },
      'p1',
      10000,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('não vale');
  });

  it('aplica em produto na lista permitida', () => {
    const r = validateCoupon(
      { ...baseCoupon, appliesToProductIds: ['p1', 'p2'] },
      'p1',
      10000,
    );
    expect(r.ok).toBe(true);
  });

  it('rejeita cupom null', () => {
    const r = validateCoupon(null, 'p1', 10000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('encontrado');
  });

  it('arredonda desconto percentual para baixo', () => {
    const c: Coupon = {
      ...baseCoupon,
      discount: { kind: 'percent', value: 33 },
    };
    const r = validateCoupon(c, 'p1', 10000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(3300);
  });
});

describe('generateRandomCode', () => {
  it('respeita o tamanho solicitado', () => {
    expect(generateRandomCode(8)).toHaveLength(8);
    expect(generateRandomCode(12)).toHaveLength(12);
    expect(generateRandomCode(4)).toHaveLength(4);
  });

  it('só usa caracteres do alfabeto sem ambiguidade', () => {
    const code = generateRandomCode(50);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    // não contém 0, O, 1, I
    expect(code).not.toMatch(/[01OI]/);
  });

  it('gera códigos únicos em sequência', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateRandomCode(10));
    expect(codes.size).toBeGreaterThan(95); // colisões raras com 32^10
  });
});
