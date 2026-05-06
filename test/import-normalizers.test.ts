import { describe, it, expect } from 'vitest';
import {
  normalizeStudent,
  normalizeCourse,
  normalizeModule,
  normalizeLesson,
  normalizeProduct,
  normalizeOrder,
  normalizeEnrollment,
  normalizeProgress,
} from '../server/imports/pipeline/normalizers';

describe('imports/pipeline/normalizers', () => {
  describe('normalizeStudent', () => {
    it('email é forçado pra lowercase', () => {
      const s = normalizeStudent({ user_email: 'A@B.COM' });
      expect(s.email).toBe('a@b.com');
    });
    it('campos vazios viram undefined/null', () => {
      const s = normalizeStudent({ user_email: 'a@b.com', first_name: '   ' });
      expect(s.firstName).toBeUndefined();
    });
    it('display_name fallback pra user_login', () => {
      const s = normalizeStudent({
        user_email: 'a@b.com',
        user_login: 'jdoe',
      });
      expect(s.displayName).toBe('jdoe');
    });
    it('status default é "ativo"', () => {
      const s = normalizeStudent({ user_email: 'a@b.com' });
      expect(s.status).toBe('ativo');
    });
  });

  describe('normalizeCourse', () => {
    it('título preservado', () => {
      const c = normalizeCourse({ course_title: 'Fundamentos' });
      expect(c.title).toBe('Fundamentos');
    });
    it('accessDurationDays prefere course_access_expires_after_days', () => {
      const c = normalizeCourse({
        course_title: 'C',
        course_access_expires_after_days: '365',
        course_duration_days: '30',
      });
      expect(c.accessDurationDays).toBe(365);
    });
    it('accessDurationDays cai pra course_duration_days', () => {
      const c = normalizeCourse({
        course_title: 'C',
        course_duration_days: '90',
      });
      expect(c.accessDurationDays).toBe(90);
    });
    it('status default publish', () => {
      const c = normalizeCourse({ course_title: 'C' });
      expect(c.status).toBe('publish');
    });
  });

  describe('normalizeModule', () => {
    it('order é convertido pra inteiro', () => {
      const m = normalizeModule({ module_title: 'M', module_order: '5' });
      expect(m.order).toBe(5);
    });
    it('order ausente vira 0', () => {
      const m = normalizeModule({ module_title: 'M' });
      expect(m.order).toBe(0);
    });
  });

  describe('normalizeLesson', () => {
    it('isMandatory default true', () => {
      const l = normalizeLesson({ lesson_title: 'L' });
      expect(l.isMandatory).toBe(true);
    });
    it('releaseType default open', () => {
      const l = normalizeLesson({ lesson_title: 'L' });
      expect(l.releaseType).toBe('open');
    });
  });

  describe('normalizeProduct', () => {
    it('regular_price em reais vira centavos', () => {
      const p = normalizeProduct({
        product_name: 'P',
        regular_price: '49,90',
      });
      expect(p.regularPriceCents).toBe(4990);
    });
    it('moeda é uppercased', () => {
      const p = normalizeProduct({
        product_name: 'P',
        regular_price: '0',
        currency: 'brl',
      });
      expect(p.currency).toBe('BRL');
    });
    it('sale_price ausente vira null', () => {
      const p = normalizeProduct({ product_name: 'P', regular_price: '0' });
      expect(p.salePriceCents).toBeNull();
    });
    it('type default simple', () => {
      const p = normalizeProduct({ product_name: 'P', regular_price: '0' });
      expect(p.type).toBe('simple');
    });
  });

  describe('normalizeOrder', () => {
    it('product_ids split_pipe', () => {
      const o = normalizeOrder({
        customer_email: 'a@b.com',
        order_status: 'completed',
        total: '100',
        product_ids: '101|102|103',
      });
      expect(o.productIds).toEqual(['101', '102', '103']);
    });
    it('email é lowercased', () => {
      const o = normalizeOrder({
        customer_email: 'A@B.COM',
        order_status: 'completed',
        total: '0',
      });
      expect(o.customerEmail).toBe('a@b.com');
    });
    it('email vazio vira null', () => {
      const o = normalizeOrder({ order_status: 'pending', total: '0' });
      expect(o.customerEmail).toBeNull();
    });
    it('billing.email é lowercased', () => {
      const o = normalizeOrder({
        order_status: 'pending',
        total: '0',
        billing_email: 'BILL@TEST.COM',
      });
      expect(o.billing!.email).toBe('bill@test.com');
    });
  });

  describe('normalizeEnrollment', () => {
    it('status default active', () => {
      const e = normalizeEnrollment({ user_email: 'a@b.com' });
      expect(e.status).toBe('active');
    });
    it('userDocument fallback chain (user_document → user_cpf → cpf)', () => {
      expect(
        normalizeEnrollment({ user_email: 'a@b.com', cpf: '12345678900' })
          .userDocument,
      ).toBe('12345678900');
      expect(
        normalizeEnrollment({
          user_email: 'a@b.com',
          user_cpf: '99999999999',
          cpf: '11111111111',
        }).userDocument,
      ).toBe('99999999999');
    });
    it('orderExternalId fallback pra wc_order_id', () => {
      const e = normalizeEnrollment({
        user_email: 'a@b.com',
        wc_order_id: 'wc-42',
      });
      expect(e.orderExternalId).toBe('wc-42');
    });
  });

  describe('normalizeProgress', () => {
    it('status default in_progress', () => {
      const p = normalizeProgress({ user_email: 'a@b.com' });
      expect(p.status).toBe('in_progress');
    });
    it('progressPercentage convertido pra int', () => {
      const p = normalizeProgress({
        user_email: 'a@b.com',
        progress_percentage: '75',
      });
      expect(p.progressPercentage).toBe(75);
    });
  });
});
