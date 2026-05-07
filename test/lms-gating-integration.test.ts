// Tests integrados das regras combinadas de gating do LMS:
// drip relativo + prerequisites + lock por enrollment date.

import { describe, it, expect } from 'vitest';
import {
  computeModuleLock,
  findModuleLockForLesson,
} from '../server/repositories/drip';
import {
  checkPrerequisites,
  computeCompletedCourseIds,
} from '../server/repositories/prerequisites';

const NOW = new Date('2026-05-08T12:00:00.000Z').getTime();

describe('Gating integrado: drip + prereqs', () => {
  it('aluno com prereqs OK + módulo ainda em drip relativo: locked', () => {
    const completedCourseIds = ['curso-base'];
    const prereqCheck = checkPrerequisites(['curso-base'], completedCourseIds);
    expect(prereqCheck.ok).toBe(true);

    // Módulo libera 7 dias após matrícula; aluno matriculou hoje
    const lock = computeModuleLock(
      { releaseAfterEnrollmentDays: 7 },
      NOW,
      { enrolledAt: '2026-05-08T12:00:00.000Z' },
    );
    expect(lock.locked).toBe(true);
    expect(lock.secondsUntilUnlock).toBe(7 * 24 * 60 * 60);
  });

  it('aluno com prereqs faltando + módulo já liberado: prereq vence', () => {
    const prereqCheck = checkPrerequisites(['curso-base'], []);
    expect(prereqCheck.ok).toBe(false);
    expect(prereqCheck.missing).toEqual(['curso-base']);

    const lock = computeModuleLock({}, NOW);
    expect(lock.locked).toBe(false);
    // Em runtime, app bloqueia matrícula via prereq antes do drip
  });

  it('drip absoluto + relativo: vence o mais tardio', () => {
    // Matriculou ontem (-1d); drip relativo libera em +7d (= 6d a partir de hoje)
    // Drip absoluto fixa em +30d
    const lock = computeModuleLock(
      {
        releaseAt: '2026-06-07T12:00:00.000Z', // +30 dias
        releaseAfterEnrollmentDays: 7,
      },
      NOW,
      { enrolledAt: '2026-05-07T12:00:00.000Z' }, // ontem
    );
    expect(lock.locked).toBe(true);
    // releaseAt absoluto (+30d) é mais tardio que relativo (+6d)
    expect(lock.lockedUntil).toBe('2026-06-07T12:00:00.000Z');
  });

  it('drip relativo > absoluto: relativo vence', () => {
    const lock = computeModuleLock(
      {
        releaseAt: '2026-05-09T12:00:00.000Z', // +1d
        releaseAfterEnrollmentDays: 30,
      },
      NOW,
      { enrolledAt: '2026-05-08T12:00:00.000Z' }, // hoje
    );
    expect(lock.locked).toBe(true);
    // Relativo vence: hoje + 30d
    const expectedRelative = new Date(
      new Date('2026-05-08T12:00:00.000Z').getTime() +
        30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(lock.lockedUntil).toBe(expectedRelative);
  });

  it('curso vazio (sem aulas): completedCourseIds vazio', () => {
    const ids = computeCompletedCourseIds([{ id: 'empty', modules: [] }], []);
    expect(ids).toEqual([]);
  });

  it('curso com módulo sem aulas: skip', () => {
    const ids = computeCompletedCourseIds(
      [{ id: 'c', modules: [{ lessons: [] }] }],
      [],
    );
    expect(ids).toEqual([]);
  });

  it('findModuleLockForLesson respeita ctx.enrolledAt', () => {
    const course = {
      modules: [
        {
          id: 'm-1',
          releaseAfterEnrollmentDays: 14,
          lessons: [{ id: 'l-1' }],
        },
      ],
    };

    const semCtx = findModuleLockForLesson(course, 'l-1', NOW);
    expect(semCtx?.lock.locked).toBe(false);

    const novoAluno = findModuleLockForLesson(course, 'l-1', NOW, {
      enrolledAt: new Date(NOW).toISOString(),
    });
    expect(novoAluno?.lock.locked).toBe(true);
    expect(novoAluno?.lock.secondsUntilUnlock).toBe(14 * 24 * 60 * 60);

    const alunoAntigo = findModuleLockForLesson(course, 'l-1', NOW, {
      enrolledAt: '2025-01-01T00:00:00.000Z', // > 14 dias atrás
    });
    expect(alunoAntigo?.lock.locked).toBe(false);
  });

  it('múltiplos pré-requisitos: status preserva ordem', () => {
    const r = checkPrerequisites(
      ['fund-1', 'fund-2', 'fund-3'],
      ['fund-2'],
    );
    expect(r.status).toEqual([
      { courseId: 'fund-1', completed: false },
      { courseId: 'fund-2', completed: true },
      { courseId: 'fund-3', completed: false },
    ]);
    expect(r.missing).toEqual(['fund-1', 'fund-3']);
  });

  it('checkPrerequisites preserva ordem em "missing"', () => {
    const r = checkPrerequisites(
      ['c1', 'c2', 'c3', 'c4', 'c5'],
      ['c2', 'c4'],
    );
    expect(r.missing).toEqual(['c1', 'c3', 'c5']);
  });
});
