import { describe, it, expect } from 'vitest';
import { mapWcStatus, __test_internals__ } from '../server/imports/adapters';
import type { NormalizedOrder } from '../server/imports/types';

const { earliestDate, latestDate, mergeOrderMeta, buildOrderMeta } =
  __test_internals__;

describe('imports/adapters internals', () => {
  describe('mapWcStatus', () => {
    it('completed → paid', () => {
      expect(mapWcStatus('completed')).toBe('paid');
    });
    it('processing/pending/on-hold → pending', () => {
      expect(mapWcStatus('processing')).toBe('pending');
      expect(mapWcStatus('pending')).toBe('pending');
      expect(mapWcStatus('on-hold')).toBe('pending');
    });
    it('cancelled → canceled (sic)', () => {
      expect(mapWcStatus('cancelled')).toBe('canceled');
    });
    it('refunded passa', () => {
      expect(mapWcStatus('refunded')).toBe('refunded');
    });
    it('failed passa', () => {
      expect(mapWcStatus('failed')).toBe('failed');
    });
  });

  describe('earliestDate / latestDate', () => {
    it('earliestDate retorna a menor; null pula', () => {
      expect(earliestDate('2025-01-15', '2025-02-01')).toBe('2025-01-15');
      expect(earliestDate('2025-02-01', '2025-01-15')).toBe('2025-01-15');
      expect(earliestDate(null, '2025-01-01')).toBe('2025-01-01');
      expect(earliestDate('2025-01-01', null)).toBe('2025-01-01');
      expect(earliestDate(null, null)).toBe(null);
    });

    it('latestDate retorna a maior; null pula', () => {
      expect(latestDate('2025-01-15', '2025-02-01')).toBe('2025-02-01');
      expect(latestDate('2025-02-01', '2025-01-15')).toBe('2025-02-01');
      expect(latestDate(null, '2025-01-01')).toBe('2025-01-01');
      expect(latestDate('2025-01-01', null)).toBe('2025-01-01');
      expect(latestDate(null, null)).toBe(null);
    });
  });

  describe('buildOrderMeta', () => {
    it('inclui campos da NormalizedOrder', () => {
      const norm: NormalizedOrder = {
        customerEmail: 'a@b.com',
        status: 'completed',
        orderDate: '2025-01-15T10:00:00Z',
        paidDate: '2025-01-15T10:30:00Z',
        completedDate: null,
        totalCents: 9990,
        currency: 'BRL',
        productIds: ['p1'],
        productSkus: [],
      };
      const meta = buildOrderMeta(norm);
      expect(meta.customerEmail).toBe('a@b.com');
      expect(meta.totalCents).toBe(9990);
      expect(meta.productIds).toEqual(['p1']);
    });
  });

  describe('mergeOrderMeta', () => {
    it('preserva valores existentes (não sobrescreve)', () => {
      const current = {
        customerEmail: 'velho@x.com',
        totalCents: 5000,
      };
      const norm: NormalizedOrder = {
        customerEmail: 'novo@x.com',
        status: 'completed',
        orderDate: '2025-01-15',
        totalCents: 9999,
        currency: 'BRL',
      };
      const merged = mergeOrderMeta(current, norm);
      expect(merged.customerEmail).toBe('velho@x.com');
      expect(merged.totalCents).toBe(5000);
    });

    it('preenche campos vazios/null/undefined no current', () => {
      const current = { customerEmail: '', totalCents: null };
      const norm: NormalizedOrder = {
        customerEmail: 'novo@x.com',
        status: 'completed',
        orderDate: '2025-01-15',
        totalCents: 9999,
        currency: 'BRL',
      };
      const merged = mergeOrderMeta(current, norm);
      expect(merged.customerEmail).toBe('novo@x.com');
      expect(merged.totalCents).toBe(9999);
    });

    it('current array vazio é preenchido', () => {
      const current = { productIds: [] };
      const norm: NormalizedOrder = {
        status: 'completed',
        orderDate: '2025-01-15',
        totalCents: 0,
        currency: 'BRL',
        productIds: ['p1', 'p2'],
      };
      const merged = mergeOrderMeta(current, norm);
      expect(merged.productIds).toEqual(['p1', 'p2']);
    });

    it('current undefined funciona', () => {
      const norm: NormalizedOrder = {
        status: 'completed',
        orderDate: '2025-01-15',
        totalCents: 100,
        currency: 'BRL',
      };
      const merged = mergeOrderMeta(undefined, norm);
      expect(merged.totalCents).toBe(100);
    });
  });
});
