// Testes dos helpers de conflict strategy 'merge' nos adapters de import.

import { describe, it, expect } from 'vitest';
import { __test_internals__ } from '../server/imports/adapters';
import type { NormalizedOrder } from '../server/imports/types';

const { earliestDate, latestDate, mergeOrderMeta, buildOrderMeta } =
  __test_internals__;

describe('earliestDate', () => {
  it('retorna a menor data', () => {
    expect(earliestDate('2025-01-15T00:00:00Z', '2025-01-10T00:00:00Z')).toBe(
      '2025-01-10T00:00:00Z',
    );
  });
  it('preserva nulls', () => {
    expect(earliestDate(null, '2025-01-01T00:00:00Z')).toBe('2025-01-01T00:00:00Z');
    expect(earliestDate('2025-01-01T00:00:00Z', null)).toBe('2025-01-01T00:00:00Z');
    expect(earliestDate(null, null)).toBeNull();
  });
});

describe('latestDate', () => {
  it('retorna a maior data', () => {
    expect(latestDate('2025-01-15T00:00:00Z', '2025-12-10T00:00:00Z')).toBe(
      '2025-12-10T00:00:00Z',
    );
  });
  it('preserva nulls', () => {
    expect(latestDate(null, '2025-01-01T00:00:00Z')).toBe('2025-01-01T00:00:00Z');
    expect(latestDate('2025-12-31T00:00:00Z', null)).toBe('2025-12-31T00:00:00Z');
  });
});

describe('mergeOrderMeta', () => {
  const baseNorm: NormalizedOrder = {
    externalOrderId: '999',
    wcOrderId: null,
    customerExternalId: null,
    customerEmail: 'novo@teste.com',
    orderNumber: '999',
    status: 'completed',
    orderDate: '2025-02-01T00:00:00Z',
    paidDate: '2025-02-02T00:00:00Z',
    completedDate: '2025-02-03T00:00:00Z',
    totalCents: 50000,
    currency: 'BRL',
    productIds: ['p1'],
    productSkus: undefined,
    billing: {},
  };

  it('preenche campos vazios no metadata existente', () => {
    const current = {
      customerEmail: 'antigo@teste.com',
      status: 'completed',
      // outros campos ausentes
    };
    const merged = mergeOrderMeta(current, baseNorm);
    expect(merged.customerEmail).toBe('antigo@teste.com'); // mantém antigo
    expect(merged.status).toBe('completed');
    expect(merged.totalCents).toBe(50000); // preenche vazio
    expect(merged.productIds).toEqual(['p1']);
  });

  it('não sobrescreve valores não-vazios', () => {
    const current = {
      customerEmail: 'antigo@teste.com',
      totalCents: 99999,
      productIds: ['old1'],
    };
    const merged = mergeOrderMeta(current, baseNorm);
    expect(merged.customerEmail).toBe('antigo@teste.com');
    expect(merged.totalCents).toBe(99999);
    expect(merged.productIds).toEqual(['old1']);
  });

  it('preenche array vazio existente com novo', () => {
    const current = { productIds: [] };
    const merged = mergeOrderMeta(current, baseNorm);
    expect(merged.productIds).toEqual(['p1']);
  });

  it('aceita current undefined', () => {
    const merged = mergeOrderMeta(undefined, baseNorm);
    expect(merged.customerEmail).toBe('novo@teste.com');
    expect(merged.totalCents).toBe(50000);
  });
});

describe('buildOrderMeta', () => {
  it('serializa todos os campos relevantes', () => {
    const meta = buildOrderMeta({
      externalOrderId: 'x',
      wcOrderId: null,
      customerExternalId: null,
      customerEmail: 'a@b.com',
      orderNumber: '1',
      status: 'pending',
      orderDate: '2025-01-01T00:00:00Z',
      paidDate: null,
      completedDate: null,
      totalCents: 100,
      currency: 'BRL',
      productIds: undefined,
      productSkus: undefined,
      billing: {},
    });
    expect(meta.customerEmail).toBe('a@b.com');
    expect(meta.totalCents).toBe(100);
    expect(meta.currency).toBe('BRL');
  });
});
