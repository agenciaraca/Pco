import { describe, it, expect } from 'vitest';
import {
  validateStudent,
  validateCourse,
  validateModule,
  validateLesson,
  validateProduct,
  validateOrder,
  validateEnrollment,
  validateProgress,
} from '../server/imports/pipeline/validators';

describe('imports/pipeline/validators', () => {
  describe('validateStudent', () => {
    it('email válido passa sem erros', () => {
      expect(validateStudent({ email: 'a@b.com' })).toEqual([]);
    });
    it('email vazio gera erro', () => {
      const errs = validateStudent({ email: '' });
      expect(errs).toHaveLength(1);
      expect(errs[0]!.field).toBe('email');
    });
    it('email malformado gera erro', () => {
      expect(validateStudent({ email: 'sem-arroba' })[0]!.field).toBe('email');
    });
    it('status desconhecido gera erro', () => {
      const errs = validateStudent({
        email: 'a@b.com',
        status: 'wat' as 'ativo',
      });
      expect(errs.find((e) => e.field === 'status')).toBeDefined();
    });
  });

  describe('validateCourse', () => {
    it('título válido passa', () => {
      expect(validateCourse({ title: 'Curso X' })).toEqual([]);
    });
    it('título vazio gera erro', () => {
      expect(validateCourse({ title: '' })[0]!.field).toBe('title');
    });
    it('accessDurationDays negativo gera erro', () => {
      const errs = validateCourse({ title: 'OK', accessDurationDays: -5 });
      expect(errs[0]!.field).toBe('accessDurationDays');
    });
    it('accessDurationDays null (vitalício) é válido', () => {
      expect(validateCourse({ title: 'OK', accessDurationDays: null })).toEqual([]);
    });
  });

  describe('validateModule', () => {
    it('válido com courseExternalId', () => {
      expect(
        validateModule({ title: 'Mod', order: 0, courseExternalId: 'c-1' }),
      ).toEqual([]);
    });
    it('sem vínculo de curso gera erro', () => {
      const errs = validateModule({ title: 'Mod', order: 0 });
      expect(errs.some((e) => e.message.includes('Vínculo'))).toBe(true);
    });
    it('order negativo gera erro', () => {
      const errs = validateModule({
        title: 'Mod',
        order: -1,
        courseExternalId: 'c',
      });
      expect(errs.find((e) => e.field === 'order')).toBeDefined();
    });
  });

  describe('validateLesson', () => {
    it('válido', () => {
      expect(validateLesson({ title: 'Aula', order: 0 })).toEqual([]);
    });
    it('título curto gera erro', () => {
      expect(validateLesson({ title: '', order: 0 })[0]!.field).toBe('title');
    });
  });

  describe('validateProduct', () => {
    it('válido', () => {
      expect(
        validateProduct({
          name: 'Produto X',
          regularPriceCents: 1000,
          currency: 'BRL',
        }),
      ).toEqual([]);
    });
    it('preço negativo gera erro', () => {
      const errs = validateProduct({
        name: 'Produto X',
        regularPriceCents: -1,
        currency: 'BRL',
      });
      expect(errs.find((e) => e.field === 'regularPriceCents')).toBeDefined();
    });
    it('moeda não-ISO gera erro', () => {
      const errs = validateProduct({
        name: 'Produto X',
        regularPriceCents: 100,
        currency: 'REAL',
      });
      expect(errs.find((e) => e.field === 'currency')).toBeDefined();
    });
  });

  describe('validateOrder', () => {
    it('válido', () => {
      expect(
        validateOrder({
          customerEmail: 'a@b.com',
          orderDate: '2025-01-01',
          status: 'completed',
          totalCents: 5000,
          currency: 'BRL',
        }),
      ).toEqual([]);
    });
    it('status inválido gera erro', () => {
      const errs = validateOrder({
        customerEmail: 'a@b.com',
        orderDate: '2025-01-01',
        status: 'oops' as 'completed',
        totalCents: 100,
        currency: 'BRL',
      });
      expect(errs.find((e) => e.field === 'status')).toBeDefined();
    });
    it('data malformada gera erro', () => {
      const errs = validateOrder({
        customerEmail: 'a@b.com',
        orderDate: '01/01/2025',
        status: 'completed',
        totalCents: 100,
        currency: 'BRL',
      });
      expect(errs.find((e) => e.field === 'orderDate')).toBeDefined();
    });
  });

  describe('validateEnrollment', () => {
    it('válido', () => {
      expect(
        validateEnrollment({
          userEmail: 'a@b.com',
          courseExternalId: 'c1',
          status: 'active',
        }),
      ).toEqual([]);
    });
    it('sem identificação de aluno gera erro', () => {
      const errs = validateEnrollment({
        courseExternalId: 'c1',
        status: 'active',
      });
      expect(errs.some((e) => e.message.includes('aluno'))).toBe(true);
    });
    it('status inválido gera erro', () => {
      const errs = validateEnrollment({
        userEmail: 'a@b.com',
        courseExternalId: 'c1',
        status: 'random' as 'active',
      });
      expect(errs.find((e) => e.field === 'status')).toBeDefined();
    });
  });

  describe('validateProgress', () => {
    it('válido', () => {
      expect(validateProgress({ userEmail: 'a@b.com' })).toEqual([]);
    });
    it('sem identificação gera erro', () => {
      expect(validateProgress({})[0]!.message).toContain('userEmail');
    });
  });
});
