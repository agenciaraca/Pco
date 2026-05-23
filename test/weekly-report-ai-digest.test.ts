import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let report: typeof import('../server/notifications/weekly-report');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ai-digest-'));
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

function makeReportData(
  overrides: Partial<import('../server/notifications/weekly-report').WeeklyReportData> = {},
): import('../server/notifications/weekly-report').WeeklyReportData {
  return {
    windowFrom: '2026-05-12T00:00:00Z',
    windowTo: '2026-05-19T00:00:00Z',
    prevWindowFrom: '2026-05-05T00:00:00Z',
    revenue: { currentCents: 150000, previousCents: 100000, deltaPct: 50 },
    newStudents: { current: 25, previous: 18, deltaPct: 39 },
    certificatesIssued: 8,
    reviews: { new: 5, averageRating: 4.6 },
    support: { opened: 3, closed: 2 },
    topProducts: [
      { name: 'Curso de Psicanálise', revenueCents: 100000, count: 5 },
      { name: 'Supervisão Clínica', revenueCents: 50000, count: 2 },
    ],
    errors: {
      totalServer: 7,
      totalClient: 12,
      byDay: [
        { day: '2026-05-18', server: 3, client: 5 },
        { day: '2026-05-17', server: 2, client: 4 },
        { day: '2026-05-16', server: 2, client: 3 },
      ],
    },
    retention: { highRisk: 4, mediumRisk: 12, lowRisk: 8 },
    completions: {
      total: 142,
      byDay: [
        { day: '2026-05-18', count: 22 },
        { day: '2026-05-17', count: 30 },
        { day: '2026-05-16', count: 25 },
        { day: '2026-05-15', count: 18 },
        { day: '2026-05-14', count: 20 },
        { day: '2026-05-13', count: 15 },
        { day: '2026-05-12', count: 12 },
      ],
    },
    ...overrides,
  };
}

describe('weekly-report AI digest', () => {
  describe('config aiDigestEnabled', () => {
    it('default false', async () => {
      const cfg = await report.getConfig();
      expect(cfg.aiDigestEnabled).toBe(false);
    });

    it('persiste aiDigestEnabled=true', async () => {
      await report.setConfig({ aiDigestEnabled: true });
      const cfg = await report.getConfig();
      expect(cfg.aiDigestEnabled).toBe(true);
    });

    it('toggle não afeta outros campos', async () => {
      await report.setConfig({ enabled: true, hourUtc: 14 });
      await report.setConfig({ aiDigestEnabled: true });
      const cfg = await report.getConfig();
      expect(cfg.enabled).toBe(true);
      expect(cfg.hourUtc).toBe(14);
      expect(cfg.aiDigestEnabled).toBe(true);
    });
  });

  describe('buildReport extended fields', () => {
    it('inclui errors, retention, completions com valores default', async () => {
      const data = await report.buildReport(new Date('2026-05-19T12:00:00Z'));
      expect(data.errors).toBeDefined();
      expect(data.errors.totalServer).toBeGreaterThanOrEqual(0);
      expect(data.errors.totalClient).toBeGreaterThanOrEqual(0);
      expect(data.errors.byDay).toBeInstanceOf(Array);
      expect(data.retention).toBeDefined();
      expect(typeof data.retention.highRisk).toBe('number');
      expect(typeof data.retention.mediumRisk).toBe('number');
      expect(typeof data.retention.lowRisk).toBe('number');
      expect(data.completions).toBeDefined();
      expect(typeof data.completions.total).toBe('number');
      expect(data.completions.byDay).toBeInstanceOf(Array);
    });
  });

  describe('renderEmailHtml with AI digest', () => {
    it('sem AI digest não inclui seção de análise', () => {
      const data = makeReportData();
      const r = report.renderEmailHtml(data);
      expect(r.html).not.toContain('Análise da IA');
      expect(r.text).not.toContain('Análise da IA');
    });

    it('com AI digest inclui seção no HTML e texto', () => {
      const data = makeReportData();
      const aiText = 'A plataforma teve crescimento sólido de 50% na receita.';
      const r = report.renderEmailHtml(data, aiText);
      expect(r.html).toContain('Análise da IA');
      expect(r.html).toContain('crescimento sólido');
      expect(r.text).toContain('--- Análise da IA ---');
      expect(r.text).toContain('crescimento sólido');
    });

    it('inclui novos KPIs no e-mail (aulas, erros, retenção)', () => {
      const data = makeReportData();
      const r = report.renderEmailHtml(data);
      expect(r.html).toContain('142'); // completions total
      expect(r.html).toContain('7'); // server errors
      expect(r.html).toContain('4'); // high risk
      expect(r.text).toContain('Aulas concluídas: 142');
      expect(r.text).toContain('Erros servidor: 7');
      expect(r.text).toContain('alto: 4');
    });

    it('destaca erros servidor com cor vermelha quando > 0', () => {
      const data = makeReportData({ errors: { totalServer: 5, totalClient: 0, byDay: [] } });
      const r = report.renderEmailHtml(data);
      expect(r.html).toContain('#dc2626');
    });

    it('sem erros servidor usa cor normal', () => {
      const data = makeReportData({ errors: { totalServer: 0, totalClient: 0, byDay: [] } });
      const r = report.renderEmailHtml(data);
      expect(r.html).not.toContain('#dc2626');
    });

    it('escapa HTML no AI digest', () => {
      const data = makeReportData();
      const r = report.renderEmailHtml(data, '<script>alert("xss")</script>');
      expect(r.html).not.toContain('<script>');
      expect(r.html).toContain('&lt;script&gt;');
    });
  });

  describe('generateAiDigest', () => {
    it('retorna null quando nenhum provider de summaries configurado', async () => {
      const data = makeReportData();
      const result = await report.generateAiDigest(data);
      expect(result).toBeNull();
    });
  });

  describe('tickWorker com aiDigestEnabled', () => {
    it('fire com sucesso quando aiDigestEnabled=false', async () => {
      await report.setConfig({ enabled: true, aiDigestEnabled: false });
      const monday9 = new Date('2026-05-18T09:00:00Z');
      const r = await report.tickWorker(monday9);
      expect(r.fired).toBe(true);
    });

    it('fire com sucesso quando aiDigestEnabled=true mas sem provider configurado', async () => {
      await report.setConfig({ enabled: true, aiDigestEnabled: true });
      const monday9 = new Date('2026-05-25T09:00:00Z');
      const r = await report.tickWorker(monday9);
      expect(r.fired).toBe(true);
    });
  });
});
