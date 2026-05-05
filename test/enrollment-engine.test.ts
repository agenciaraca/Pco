import { describe, it, expect } from 'vitest';
import {
  resolveStartDate,
  resolveExpirationDate,
  resolveEnrollmentDates,
} from '../server/imports/pipeline/enrollment-engine';
import type {
  NormalizedOrder,
  NormalizedEnrollment,
  NormalizedCourse,
} from '../server/imports/types';

const baseOrder = (overrides: Partial<NormalizedOrder> = {}): NormalizedOrder => ({
  status: 'completed',
  orderDate: '2024-01-10T10:00:00Z',
  paidDate: '2024-01-11T10:00:00Z',
  completedDate: '2024-01-12T10:00:00Z',
  totalCents: 9990,
  currency: 'BRL',
  customerEmail: 'a@b.com',
  productIds: [],
  productSkus: [],
  ...overrides,
});

const baseEnrollment = (
  overrides: Partial<NormalizedEnrollment> = {},
): NormalizedEnrollment => ({
  status: 'active',
  ...overrides,
});

const baseCourse = (
  overrides: Partial<NormalizedCourse> = {},
): NormalizedCourse => ({
  title: 'Curso X',
  ...overrides,
});

describe('enrollment engine — resolveStartDate', () => {
  it('paid_date prioriza paidDate', () => {
    const d = resolveStartDate({
      startRule: 'paid_date',
      expirationRule: 'lifetime',
      order: baseOrder(),
      enrollment: baseEnrollment(),
    });
    expect(d).toContain('2024-01-11');
  });

  it('paid_date fallback para completedDate quando paidDate ausente', () => {
    const d = resolveStartDate({
      startRule: 'paid_date',
      expirationRule: 'lifetime',
      order: baseOrder({ paidDate: undefined }),
      enrollment: baseEnrollment(),
    });
    expect(d).toContain('2024-01-12');
  });

  it('order_date usa orderDate', () => {
    const d = resolveStartDate({
      startRule: 'order_date',
      expirationRule: 'lifetime',
      order: baseOrder(),
      enrollment: baseEnrollment(),
    });
    expect(d).toContain('2024-01-10');
  });

  it('imported usa enrollment.enrollmentStartDate', () => {
    const d = resolveStartDate({
      startRule: 'imported',
      expirationRule: 'lifetime',
      enrollment: baseEnrollment({ enrollmentStartDate: '2023-12-01T00:00:00Z' }),
    });
    expect(d).toContain('2023-12-01');
  });

  it('imported sem data → fallback "now"', () => {
    const d = resolveStartDate({
      startRule: 'imported',
      expirationRule: 'lifetime',
      enrollment: baseEnrollment(),
    });
    expect(new Date(d).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});

describe('enrollment engine — resolveExpirationDate', () => {
  it('lifetime sempre retorna null', () => {
    expect(
      resolveExpirationDate(
        {
          startRule: 'paid_date',
          expirationRule: 'lifetime',
          enrollment: baseEnrollment(),
        },
        '2024-01-01T00:00:00Z',
      ),
    ).toBeNull();
  });

  it('start_plus_duration usa accessDurationDays do enrollment > course > default', () => {
    expect(
      resolveExpirationDate(
        {
          startRule: 'paid_date',
          expirationRule: 'start_plus_duration',
          enrollment: baseEnrollment({ accessDurationDays: 30 }),
          course: baseCourse({ accessDurationDays: 90 }),
          defaultAccessDurationDays: 365,
        },
        '2024-01-01T00:00:00Z',
      ),
    ).toBe(new Date('2024-01-31T00:00:00Z').toISOString());
  });

  it('start_plus_duration cai pra course.accessDurationDays', () => {
    expect(
      resolveExpirationDate(
        {
          startRule: 'paid_date',
          expirationRule: 'start_plus_duration',
          enrollment: baseEnrollment(),
          course: baseCourse({ accessDurationDays: 90 }),
        },
        '2024-01-01T00:00:00Z',
      ),
    ).toBe(new Date('2024-03-31T00:00:00Z').toISOString()); // 2024 é bissexto: 31+29+31 = 91 dias mar→jan
  });

  it('explicit usa enrollment.enrollmentExpirationDate', () => {
    expect(
      resolveExpirationDate(
        {
          startRule: 'paid_date',
          expirationRule: 'explicit',
          enrollment: baseEnrollment({
            enrollmentExpirationDate: '2025-06-01T00:00:00Z',
          }),
        },
        '2024-01-01T00:00:00Z',
      ),
    ).toContain('2025-06-01');
  });

  it('course_fixed_end usa course.accessExpiresAt', () => {
    expect(
      resolveExpirationDate(
        {
          startRule: 'paid_date',
          expirationRule: 'course_fixed_end',
          enrollment: baseEnrollment(),
          course: baseCourse({ accessExpiresAt: '2025-12-31T23:59:59Z' }),
        },
        '2024-01-01T00:00:00Z',
      ),
    ).toContain('2025-12-31');
  });

  it('order_plus_duration soma à orderDate', () => {
    expect(
      resolveExpirationDate(
        {
          startRule: 'paid_date',
          expirationRule: 'order_plus_duration',
          enrollment: baseEnrollment(),
          order: baseOrder({ orderDate: '2024-01-10T00:00:00Z' }),
          defaultAccessDurationDays: 365,
        },
        '2024-01-15T00:00:00Z',
      ),
    ).toBe(new Date('2025-01-09T00:00:00Z').toISOString());
  });

  it('paid_plus_duration usa paidDate ou fallback completedDate', () => {
    const r = resolveExpirationDate(
      {
        startRule: 'paid_date',
        expirationRule: 'paid_plus_duration',
        enrollment: baseEnrollment(),
        order: baseOrder({ paidDate: undefined, completedDate: '2024-01-12T00:00:00Z' }),
        defaultAccessDurationDays: 30,
      },
      '2024-01-15T00:00:00Z',
    );
    expect(r).toBe(new Date('2024-02-11T00:00:00Z').toISOString());
  });
});

describe('enrollment engine — resolveEnrollmentDates (composto)', () => {
  it('retorna start + expiration computados', () => {
    const r = resolveEnrollmentDates({
      startRule: 'paid_date',
      expirationRule: 'start_plus_duration',
      enrollment: baseEnrollment(),
      order: baseOrder(),
      defaultAccessDurationDays: 365,
    });
    expect(r.startDate).toContain('2024-01-11');
    expect(r.expirationDate).toContain('2025-01-10');
  });

  it('lifetime devolve expirationDate=null mas startDate populado', () => {
    const r = resolveEnrollmentDates({
      startRule: 'now',
      expirationRule: 'lifetime',
      enrollment: baseEnrollment(),
    });
    expect(r.startDate).toBeTruthy();
    expect(r.expirationDate).toBeNull();
  });
});
