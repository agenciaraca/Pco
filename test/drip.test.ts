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
