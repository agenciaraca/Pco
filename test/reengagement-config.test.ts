import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let cfg: typeof import('../server/reengagement/config-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-reeng-'));
  process.env.DATA_DIR = tmpDir;
  cfg = await import('../server/reengagement/config-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('reengagement/config-store', () => {
  it('getConfig retorna defaults na 1ª leitura', async () => {
    const c = await cfg.getConfig();
    expect(c.enabled).toBe(false);
    expect(c.inactivityDays).toBe(14);
    expect(c.cooldownDays).toBe(14);
    expect(c.onlyEnrolled).toBe(true);
    expect(c.subject).toContain('AVA PCO');
    expect(c.bodyHtml).toContain('{{name}}');
    expect(c.bodyHtml).toContain('{{loginUrl}}');
  });

  it('setConfig faz merge e bumpa updatedAt', async () => {
    const before = await cfg.getConfig();
    await new Promise((r) => setTimeout(r, 5));
    const after = await cfg.setConfig({ enabled: true, inactivityDays: 30 });
    expect(after.enabled).toBe(true);
    expect(after.inactivityDays).toBe(30);
    // outros valores preservados
    expect(after.cooldownDays).toBe(14);
    expect(after.subject).toBe(before.subject);
    expect(after.updatedAt > before.updatedAt).toBe(true);
  });

  it('recordSent adiciona entry; listRecentSends ordena desc', async () => {
    await cfg.recordSent('u-1', 'a@x.com');
    await new Promise((r) => setTimeout(r, 10));
    await cfg.recordSent('u-2', 'b@x.com');
    const list = await cfg.listRecentSends();
    expect(list.length).toBeGreaterThanOrEqual(2);
    // mais recente primeiro
    expect(list[0]!.userId).toBe('u-2');
  });

  it('lastSentForUser retorna timestamp mais recente do user', async () => {
    await cfg.recordSent('u-multi', 'm@x.com');
    await new Promise((r) => setTimeout(r, 5));
    await cfg.recordSent('u-multi', 'm@x.com');
    const last = await cfg.lastSentForUser('u-multi');
    expect(last).not.toBeNull();
    // sanity: é ISO string
    expect(last).toMatch(/T.*Z$/);
  });

  it('lastSentForUser retorna null pra user sem sends', async () => {
    expect(await cfg.lastSentForUser('user-virgem')).toBeNull();
  });

  it('listRecentSends respeita limit', async () => {
    const r = await cfg.listRecentSends(2);
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it('listRecentSends clamp limit (>=1, <=1000)', async () => {
    const r0 = await cfg.listRecentSends(0);
    expect(r0.length).toBeLessThanOrEqual(1);
    const rBig = await cfg.listRecentSends(99999);
    expect(rBig.length).toBeLessThanOrEqual(1000);
  });

  it('setConfig persiste através de leituras', async () => {
    await cfg.setConfig({ subject: 'novo-subject' });
    const r = await cfg.getConfig();
    expect(r.subject).toBe('novo-subject');
  });
});
