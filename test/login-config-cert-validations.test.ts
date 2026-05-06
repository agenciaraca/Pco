import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let login: typeof import('../server/repositories/login-config');
let certVal: typeof import('../server/repositories/cert-validations');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cfg-'));
  process.env.DATA_DIR = tmpDir;
  login = await import('../server/repositories/login-config');
  certVal = await import('../server/repositories/cert-validations');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('login-config', () => {
  it('getConfig devolve defaults na primeira leitura', async () => {
    const c = await login.getConfig();
    expect(c.title).toContain('formação');
    expect(c.theme).toBe('light');
    expect(c.position).toBe('right');
    expect(c.fromColor).toBe('#063B49');
    expect(c.logoUrl).toBeNull();
  });

  it('updateConfig faz merge + bumpa updatedAt', async () => {
    const before = await login.getConfig();
    await new Promise((r) => setTimeout(r, 5));
    const after = await login.updateConfig({
      title: 'Novo título',
      theme: 'dark',
      logoUrl: 'https://x/logo.png',
    });
    expect(after.title).toBe('Novo título');
    expect(after.theme).toBe('dark');
    expect(after.logoUrl).toBe('https://x/logo.png');
    // não tocados continuam iguais
    expect(after.fromColor).toBe(before.fromColor);
    expect(after.position).toBe(before.position);
    expect(after.updatedAt > before.updatedAt).toBe(true);
  });

  it('resetConfig volta pra defaults', async () => {
    await login.updateConfig({ title: 'modificado', theme: 'dark' });
    const r = await login.resetConfig();
    expect(r.title).toContain('formação'); // valor default
    expect(r.theme).toBe('light');
  });
});

describe('cert-validations', () => {
  it('recordValidation cria entry nova', async () => {
    await certVal.recordValidation('CERT-ABC');
    const r = await certVal.getByCode('CERT-ABC');
    expect(r).not.toBeNull();
    expect(r!.count).toBe(1);
    expect(r!.firstAt).toBe(r!.lastAt);
  });

  it('recordValidation incrementa contador (idempotente por código)', async () => {
    await certVal.recordValidation('CERT-INC');
    await new Promise((r) => setTimeout(r, 5));
    await certVal.recordValidation('CERT-INC');
    await certVal.recordValidation('CERT-INC');
    const r = await certVal.getByCode('CERT-INC');
    expect(r!.count).toBe(3);
    // lastAt > firstAt
    expect(r!.lastAt > r!.firstAt).toBe(true);
  });

  it('códigos diferentes coexistem', async () => {
    await certVal.recordValidation('CERT-1');
    await certVal.recordValidation('CERT-2');
    const all = await certVal.listAll();
    expect(all.find((v) => v.code === 'CERT-1')).toBeDefined();
    expect(all.find((v) => v.code === 'CERT-2')).toBeDefined();
  });

  it('getByCode retorna null pra código inexistente', async () => {
    expect(await certVal.getByCode('CERT-ZZZ')).toBeNull();
  });

  it('listAll retorna todas as validações', async () => {
    const all = await certVal.listAll();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
