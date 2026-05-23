import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let report: typeof import('../server/notifications/weekly-report');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-weekly-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
  report = await import('../server/notifications/weekly-report');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await report._resetForTests();
  vi.restoreAllMocks();
});

describe('weekly-report', () => {
  describe('config', () => {
    it('default disabled, segunda 9h UTC', async () => {
      const cfg = await report.getConfig();
      expect(cfg.enabled).toBe(false);
      expect(cfg.dayOfWeekUtc).toBe(1);
      expect(cfg.hourUtc).toBe(9);
    });

    it('clamp dayOfWeekUtc inválido pra segunda', async () => {
      const c = await report.setConfig({ dayOfWeekUtc: 99 });
      expect(c.dayOfWeekUtc).toBe(1);
    });

    it('clamp hourUtc inválido pra extremos', async () => {
      const c1 = await report.setConfig({ hourUtc: -5 });
      expect(c1.hourUtc).toBe(0);
      const c2 = await report.setConfig({ hourUtc: 99 });
      expect(c2.hourUtc).toBe(23);
    });

    it('persiste enabled=true', async () => {
      await report.setConfig({ enabled: true });
      const c = await report.getConfig();
      expect(c.enabled).toBe(true);
    });
  });

  describe('buildReport', () => {
    it('retorna estrutura completa zerada quando não há dados', async () => {
      const data = await report.buildReport(new Date('2026-05-06T12:00:00Z'));
      expect(data.windowFrom).toBeTruthy();
      expect(data.windowTo).toBeTruthy();
      expect(data.revenue.currentCents).toBe(0);
      expect(data.revenue.deltaPct).toBe(0);
      expect(data.newStudents.current).toBe(0);
      expect(data.certificatesIssued).toBe(0);
      expect(data.topProducts).toEqual([]);
    });

    it('janelas: windowTo - windowFrom = 7 dias', async () => {
      const now = new Date('2026-05-06T12:00:00Z');
      const data = await report.buildReport(now);
      const span =
        new Date(data.windowTo).getTime() - new Date(data.windowFrom).getTime();
      expect(span).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('renderEmailHtml', () => {
    it('inclui receita formatada e contagem de alunos', () => {
      const data: import('../server/notifications/weekly-report').WeeklyReportData = {
        windowFrom: '2026-04-29T12:00:00Z',
        windowTo: '2026-05-06T12:00:00Z',
        prevWindowFrom: '2026-04-22T12:00:00Z',
        revenue: { currentCents: 50000, previousCents: 30000, deltaPct: 67 },
        newStudents: { current: 12, previous: 8, deltaPct: 50 },
        certificatesIssued: 5,
        reviews: { new: 3, averageRating: 4.5 },
        support: { opened: 2, closed: 1 },
        topProducts: [{ name: 'Curso X', revenueCents: 50000, count: 1 }],
        errors: { totalServer: 0, totalClient: 0, byDay: [] },
        retention: { highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        completions: { total: 0, byDay: [] },
      };
      const r = report.renderEmailHtml(data);
      expect(r.subject).toContain('R$ 500,00');
      expect(r.html).toContain('R$ 500,00');
      expect(r.html).toContain('12'); // novos alunos
      expect(r.html).toContain('5'); // certificados
      expect(r.html).toContain('▲ 67%'); // delta receita positivo
      expect(r.html).toContain('Curso X');
      expect(r.text).toContain('Relatório semanal AVA PCO');
    });

    it('arrow = quando delta zero', () => {
      const data: import('../server/notifications/weekly-report').WeeklyReportData = {
        windowFrom: '2026-04-29T00:00:00Z',
        windowTo: '2026-05-06T00:00:00Z',
        prevWindowFrom: '2026-04-22T00:00:00Z',
        revenue: { currentCents: 0, previousCents: 0, deltaPct: 0 },
        newStudents: { current: 0, previous: 0, deltaPct: 0 },
        certificatesIssued: 0,
        reviews: { new: 0, averageRating: 0 },
        support: { opened: 0, closed: 0 },
        topProducts: [],
        errors: { totalServer: 0, totalClient: 0, byDay: [] },
        retention: { highRisk: 0, mediumRisk: 0, lowRisk: 0 },
        completions: { total: 0, byDay: [] },
      };
      const r = report.renderEmailHtml(data);
      expect(r.html).toContain('— 0%');
    });
  });

  describe('tickWorker idempotência', () => {
    it('não fire quando enabled=false', async () => {
      const r = await report.tickWorker(new Date('2026-05-04T09:00:00Z')); // segunda 9h
      expect(r.fired).toBe(false);
    });

    it('não fire em dia/hora errados', async () => {
      await report.setConfig({ enabled: true });
      // Domingo 9h
      const r1 = await report.tickWorker(new Date('2026-05-03T09:00:00Z'));
      expect(r1.fired).toBe(false);
      // Segunda 8h
      const r2 = await report.tickWorker(new Date('2026-05-04T08:00:00Z'));
      expect(r2.fired).toBe(false);
    });

    it('fire only once per day mesmo com múltiplos ticks', async () => {
      await report.setConfig({ enabled: true });
      const monday9 = new Date('2026-05-04T09:00:00Z');
      const r1 = await report.tickWorker(monday9);
      expect(r1.fired).toBe(true);
      // Tick outra vez no mesmo dia/hora
      const r2 = await report.tickWorker(monday9);
      expect(r2.fired).toBe(false);
    });
  });
});
