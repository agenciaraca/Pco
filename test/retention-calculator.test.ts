import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let calc: typeof import('../server/services/retention-calculator');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ret-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.DATABASE_URL;
  calc = await import('../server/services/retention-calculator');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('retention-calculator: computeStudentRisk', () => {
  const NOW = new Date('2026-05-17T12:00:00Z');

  function makeStudent(overrides: Record<string, unknown> = {}) {
    return {
      id: 's-test',
      name: 'Test',
      email: 't@test.com',
      enrolledCourseIds: [],
      progressByCourse: {},
      status: 'ativo' as const,
      riskScore: 0,
      lastAccessAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      ...overrides,
    };
  }

  it('aluno ativo recente com progresso esperado: score baixo', () => {
    const r = calc.computeStudentRisk(
      makeStudent({
        lastAccessAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(), // 2 dias
        enrolledCourseIds: ['c1'],
        progressByCourse: { c1: 50 },
        enrollmentDates: { c1: new Date(NOW.getTime() - 30 * 86_400_000).toISOString() },
      }),
      { now: NOW, courseHours: () => 30 },
    );
    expect(r.level).toBe('baixo');
    expect(r.score).toBeLessThan(31);
  });

  it('sem acesso há +90 dias: inatividade pesa 40', () => {
    const r = calc.computeStudentRisk(
      makeStudent({
        lastAccessAt: new Date(NOW.getTime() - 100 * 86_400_000).toISOString(),
      }),
      { now: NOW },
    );
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.reasons.some((x) => x.includes('100 dias'))).toBe(true);
  });

  it('progresso bem abaixo do esperado: contribui ao score', () => {
    const r = calc.computeStudentRisk(
      makeStudent({
        lastAccessAt: new Date(NOW.getTime() - 5 * 86_400_000).toISOString(),
        enrolledCourseIds: ['c1'],
        progressByCourse: { c1: 5 },
        enrollmentDates: { c1: new Date(NOW.getTime() - 60 * 86_400_000).toISOString() },
      }),
      { now: NOW, courseHours: () => 30, hoursPerDay: 1 },
    );
    // Esperado ~100%, real 5% → gap alto
    expect(r.realProgress).toBe(5);
    expect(r.expectedProgress).toBeGreaterThanOrEqual(90);
    expect(r.score).toBeGreaterThan(30);
  });

  it('sem cursos matriculados: 10 pts onboarding', () => {
    const r = calc.computeStudentRisk(makeStudent({ enrolledCourseIds: [] }), {
      now: NOW,
    });
    expect(r.reasons).toContain('Sem cursos matriculados');
  });

  it('aluno crítico: combinação de fatores', () => {
    const r = calc.computeStudentRisk(
      makeStudent({
        lastAccessAt: new Date(NOW.getTime() - 200 * 86_400_000).toISOString(),
        enrolledCourseIds: ['c1', 'c2'],
        progressByCourse: { c1: 0, c2: 2 },
        enrollmentDates: {
          c1: new Date(NOW.getTime() - 90 * 86_400_000).toISOString(),
          c2: new Date(NOW.getTime() - 60 * 86_400_000).toISOString(),
        },
      }),
      { now: NOW, courseHours: () => 30 },
    );
    expect(['alto', 'critico']).toContain(r.level);
    expect(r.score).toBeGreaterThanOrEqual(56);
  });

  it('recommendedAction adapta ao level', () => {
    const baixo = calc.computeStudentRisk(makeStudent(), { now: NOW });
    expect(baixo.recommendedAction).toContain('Monitorar');
    const critico = calc.computeStudentRisk(
      makeStudent({
        lastAccessAt: new Date(NOW.getTime() - 365 * 86_400_000).toISOString(),
        enrolledCourseIds: ['c1'],
        progressByCourse: { c1: 0 },
        enrollmentDates: { c1: new Date(NOW.getTime() - 180 * 86_400_000).toISOString() },
      }),
      { now: NOW, courseHours: () => 30 },
    );
    expect(critico.recommendedAction).toContain('imediato');
  });
});
