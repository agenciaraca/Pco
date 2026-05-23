import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let mod: typeof import('../server/notifications/student-progress-email');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-stprog-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'd'.repeat(64);
  mod = await import('../server/notifications/student-progress-email');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await mod._resetForTests();
});

describe('student-progress-email', () => {
  describe('config', () => {
    it('default disabled, domingo 10h UTC', async () => {
      const cfg = await mod.getConfig();
      expect(cfg.enabled).toBe(false);
      expect(cfg.dayOfWeekUtc).toBe(0);
      expect(cfg.hourUtc).toBe(10);
    });

    it('persiste enabled + day/hour', async () => {
      await mod.setConfig({ enabled: true, dayOfWeekUtc: 6, hourUtc: 15 });
      const cfg = await mod.getConfig();
      expect(cfg.enabled).toBe(true);
      expect(cfg.dayOfWeekUtc).toBe(6);
      expect(cfg.hourUtc).toBe(15);
    });

    it('clamp hourUtc inválido', async () => {
      const c = await mod.setConfig({ hourUtc: 99 });
      expect(c.hourUtc).toBe(23);
    });

    it('clamp dayOfWeekUtc inválido', async () => {
      const c = await mod.setConfig({ dayOfWeekUtc: -1 });
      expect(c.dayOfWeekUtc).toBe(0);
    });
  });

  describe('renderEmail', () => {
    it('gera subject com aulas da semana quando > 0', () => {
      const r = mod.renderEmail({
        studentName: 'Maria Silva',
        lessonsCompletedThisWeek: 5,
        totalLessonsCompleted: 20,
        currentStreak: 3,
        longestStreak: 7,
        courseProgress: [
          { courseTitle: 'Psicanálise', completed: 10, total: 32, pct: 31 },
        ],
      });
      expect(r.subject).toContain('5 aula(s)');
      expect(r.html).toContain('Maria');
      expect(r.html).toContain('3 dia(s) seguidos');
      expect(r.html).toContain('31%');
      expect(r.text).toContain('Streak: 3');
    });

    it('subject genérico quando 0 aulas na semana', () => {
      const r = mod.renderEmail({
        studentName: 'João',
        lessonsCompletedThisWeek: 0,
        totalLessonsCompleted: 5,
        currentStreak: 0,
        longestStreak: 2,
        courseProgress: [],
      });
      expect(r.subject).toContain('resumo semanal');
      expect(r.html).toContain('Retome seus estudos');
    });

    it('sem streak não mostra bloco verde', () => {
      const r = mod.renderEmail({
        studentName: 'Ana',
        lessonsCompletedThisWeek: 1,
        totalLessonsCompleted: 1,
        currentStreak: 0,
        longestStreak: 0,
        courseProgress: [],
      });
      expect(r.html).not.toContain('dia(s) seguidos');
    });
  });

  describe('tickWorker', () => {
    it('não fire quando disabled', async () => {
      const r = await mod.tickWorker(new Date('2026-05-25T10:00:00Z'));
      expect(r.fired).toBe(false);
    });

    it('não fire em dia errado', async () => {
      await mod.setConfig({ enabled: true, dayOfWeekUtc: 0 });
      const monday = new Date('2026-05-25T10:00:00Z'); // segunda
      const r = await mod.tickWorker(monday);
      expect(r.fired).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('retorna null inicialmente', () => {
      const s = mod.getStatus();
      expect(s.lastRunAt).toBeNull();
      expect(s.lastResult).toBeNull();
    });
  });
});
