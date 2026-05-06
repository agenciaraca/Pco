import { describe, it, expect } from 'vitest';
import { computeModuleLock, findModuleLockForLesson } from '../server/repositories/drip';

const NOW = new Date('2026-05-06T12:00:00.000Z').getTime();

describe('computeModuleLock', () => {
  it('módulo sem releaseAt nunca está locked', () => {
    expect(computeModuleLock({}, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
      secondsUntilUnlock: 0,
    });
    expect(computeModuleLock({ releaseAt: null }, NOW).locked).toBe(false);
  });

  it('releaseAt no passado → unlocked', () => {
    const r = computeModuleLock(
      { releaseAt: '2026-05-05T12:00:00.000Z' },
      NOW,
    );
    expect(r.locked).toBe(false);
    expect(r.lockedUntil).toBeNull();
  });

  it('releaseAt exatamente agora → unlocked', () => {
    const r = computeModuleLock(
      { releaseAt: '2026-05-06T12:00:00.000Z' },
      NOW,
    );
    expect(r.locked).toBe(false);
  });

  it('releaseAt no futuro → locked com countdown em segundos', () => {
    const r = computeModuleLock(
      { releaseAt: '2026-05-06T12:00:30.000Z' }, // +30s
      NOW,
    );
    expect(r.locked).toBe(true);
    expect(r.lockedUntil).toBe('2026-05-06T12:00:30.000Z');
    expect(r.secondsUntilUnlock).toBe(30);
  });

  it('aceita Date object', () => {
    const r = computeModuleLock(
      { releaseAt: new Date('2026-05-06T13:00:00.000Z') },
      NOW,
    );
    expect(r.locked).toBe(true);
    expect(r.secondsUntilUnlock).toBe(3600);
  });

  it('releaseAt inválido → unlocked (não-fatal)', () => {
    const r = computeModuleLock(
      { releaseAt: 'not-a-date' },
      NOW,
    );
    expect(r.locked).toBe(false);
  });

  it('arredonda secondsUntilUnlock pra cima', () => {
    const r = computeModuleLock(
      { releaseAt: '2026-05-06T12:00:00.500Z' }, // +500ms
      NOW,
    );
    expect(r.secondsUntilUnlock).toBe(1);
  });
});

describe('findModuleLockForLesson', () => {
  const course = {
    modules: [
      {
        id: 'mod-1',
        releaseAt: null,
        lessons: [{ id: 'l-1' }, { id: 'l-2' }],
      },
      {
        id: 'mod-2',
        releaseAt: '2026-06-01T00:00:00.000Z',
        lessons: [{ id: 'l-3' }],
      },
    ],
  };

  it('retorna módulo que contém a aula + lock info', () => {
    const r = findModuleLockForLesson(course, 'l-3', NOW);
    expect(r).toBeTruthy();
    expect(r!.moduleId).toBe('mod-2');
    expect(r!.lock.locked).toBe(true);
  });

  it('retorna null se a aula não existe em nenhum módulo', () => {
    const r = findModuleLockForLesson(course, 'l-inexistente', NOW);
    expect(r).toBeNull();
  });

  it('retorna lock unlocked pra módulos sem releaseAt', () => {
    const r = findModuleLockForLesson(course, 'l-1', NOW);
    expect(r?.lock.locked).toBe(false);
  });
});

describe('drip relativo (releaseAfterEnrollmentDays)', () => {
  it('sem enrolledAt: drip relativo é ignorado', () => {
    const r = computeModuleLock(
      { releaseAfterEnrollmentDays: 7 },
      NOW,
      {},
    );
    expect(r.locked).toBe(false);
  });

  it('matriculou hoje, módulo libera em 7 dias → locked', () => {
    const r = computeModuleLock(
      { releaseAfterEnrollmentDays: 7 },
      NOW,
      { enrolledAt: '2026-05-06T12:00:00.000Z' },
    );
    expect(r.locked).toBe(true);
    // 7 dias = 604800 seconds
    expect(r.secondsUntilUnlock).toBe(7 * 24 * 60 * 60);
  });

  it('matriculou há 8 dias, módulo libera em 7 → unlocked', () => {
    const r = computeModuleLock(
      { releaseAfterEnrollmentDays: 7 },
      NOW,
      { enrolledAt: '2026-04-28T12:00:00.000Z' },
    );
    expect(r.locked).toBe(false);
  });

  it('drip 0 dias é ignorado (>= 1 obrigatório)', () => {
    const r = computeModuleLock(
      { releaseAfterEnrollmentDays: 0 },
      NOW,
      { enrolledAt: '2026-05-06T12:00:00.000Z' },
    );
    expect(r.locked).toBe(false);
  });

  it('combina absoluto + relativo: vence o mais tardio', () => {
    // releaseAt em 1h, drip relativo em 30 dias → drip vence
    const r = computeModuleLock(
      {
        releaseAt: '2026-05-06T13:00:00.000Z', // +1h
        releaseAfterEnrollmentDays: 30, // +30d
      },
      NOW,
      { enrolledAt: '2026-05-06T12:00:00.000Z' },
    );
    expect(r.locked).toBe(true);
    expect(r.secondsUntilUnlock).toBeGreaterThanOrEqual(30 * 24 * 60 * 60);
  });

  it('combina absoluto + relativo: drip já passou mas releaseAt não', () => {
    const r = computeModuleLock(
      {
        releaseAt: '2026-12-31T00:00:00.000Z', // futuro distante
        releaseAfterEnrollmentDays: 7,
      },
      NOW,
      { enrolledAt: '2025-01-01T00:00:00.000Z' }, // matriculou ano passado
    );
    expect(r.locked).toBe(true);
    expect(r.lockedUntil).toBe('2026-12-31T00:00:00.000Z');
  });

  it('findModuleLockForLesson respeita ctx', () => {
    const c = {
      modules: [
        {
          id: 'm-1',
          releaseAfterEnrollmentDays: 14,
          lessons: [{ id: 'l-1' }],
        },
      ],
    };
    const sem = findModuleLockForLesson(c, 'l-1', NOW);
    expect(sem?.lock.locked).toBe(false);
    const com = findModuleLockForLesson(c, 'l-1', NOW, {
      enrolledAt: '2026-05-06T12:00:00.000Z',
    });
    expect(com?.lock.locked).toBe(true);
  });
});
