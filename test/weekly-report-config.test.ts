import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let report: typeof import('../server/notifications/weekly-report');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-wr-cfg-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
  report = await import('../server/notifications/weekly-report');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await report._resetForTests();
});

describe('weekly-report config setters', () => {
  it('aceita partial setConfig (mantém defaults pros não-passados)', async () => {
    await report.setConfig({ enabled: true });
    const cfg = await report.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.dayOfWeekUtc).toBe(1); // segunda default
    expect(cfg.hourUtc).toBe(9); // 9h default
    expect(cfg.recipientRoles).toEqual(['admin', 'superadmin']);
  });

  it('preserva enabled depois de setConfig com outros campos', async () => {
    await report.setConfig({ enabled: true });
    await report.setConfig({ dayOfWeekUtc: 5 });
    const cfg = await report.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.dayOfWeekUtc).toBe(5);
  });

  it('clamp hour < 0 → 0', async () => {
    const cfg = await report.setConfig({ hourUtc: -5 });
    expect(cfg.hourUtc).toBe(0);
  });

  it('clamp hour > 23 → 23', async () => {
    const cfg = await report.setConfig({ hourUtc: 99 });
    expect(cfg.hourUtc).toBe(23);
  });

  it('dayOfWeek inválido → 1 (segunda)', async () => {
    const cfg = await report.setConfig({ dayOfWeekUtc: 99 });
    expect(cfg.dayOfWeekUtc).toBe(1);
    const cfg2 = await report.setConfig({ dayOfWeekUtc: -3 });
    expect(cfg2.dayOfWeekUtc).toBe(1);
  });

  it('aceita recipientRoles customizado', async () => {
    const cfg = await report.setConfig({ recipientRoles: ['admin'] });
    expect(cfg.recipientRoles).toEqual(['admin']);
  });

  it('persiste após múltiplas chamadas getConfig', async () => {
    await report.setConfig({ enabled: true, hourUtc: 14 });
    const cfg1 = await report.getConfig();
    const cfg2 = await report.getConfig();
    expect(cfg1.enabled).toBe(true);
    expect(cfg2.enabled).toBe(true);
    expect(cfg2.hourUtc).toBe(14);
  });
});
