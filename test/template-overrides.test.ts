import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let overrides: typeof import('../server/notifications/template-overrides');
let templates: typeof import('../server/notifications/templates');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-tplo-'));
  process.env.DATA_DIR = tmpDir;
  overrides = await import('../server/notifications/template-overrides');
  templates = await import('../server/notifications/templates');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await overrides._resetForTests();
});

describe('template-overrides store', () => {
  it('lista vazia inicialmente', async () => {
    expect(await overrides.listOverrides()).toEqual([]);
  });

  it('setOverride cria entry novo', async () => {
    const r = await overrides.setOverride('password_reset', {
      subject: 'Custom subject',
      brandColor: '#ff0000',
    });
    expect(r.name).toBe('password_reset');
    expect(r.subject).toBe('Custom subject');
    expect(r.brandColor).toBe('#ff0000');
  });

  it('setOverride substitui se já existe (não duplica)', async () => {
    await overrides.setOverride('welcome', { subject: 'V1' });
    await overrides.setOverride('welcome', { subject: 'V2' });
    const all = await overrides.listOverrides();
    expect(all).toHaveLength(1);
    expect(all[0].subject).toBe('V2');
  });

  it('campos vazios viram undefined (não persistem string vazia)', async () => {
    const r = await overrides.setOverride('order_paid', {
      subject: 'OK',
      brandColor: '   ',
      logoUrl: '',
    });
    expect(r.subject).toBe('OK');
    expect(r.brandColor).toBeUndefined();
    expect(r.logoUrl).toBeUndefined();
  });

  it('getOverride retorna null quando não existe', async () => {
    expect(await overrides.getOverride('xxx')).toBeNull();
  });

  it('deleteOverride remove + retorna true', async () => {
    await overrides.setOverride('welcome', { subject: 'X' });
    expect(await overrides.deleteOverride('welcome')).toBe(true);
    expect(await overrides.getOverride('welcome')).toBeNull();
  });

  it('deleteOverride retorna false quando não existe', async () => {
    expect(await overrides.deleteOverride('inexistente')).toBe(false);
  });
});

describe('templates com override aplicado', () => {
  it('subject custom substitui default', () => {
    const r = templates.previewTemplate('password_reset', {
      subject: 'Subject custom',
    });
    expect(r.subject).toBe('Subject custom');
  });

  it('brandColor custom aparece no HTML', () => {
    const r = templates.previewTemplate('order_paid', {
      brandColor: '#ff0000',
    });
    expect(r.html).toContain('#ff0000');
  });

  it('logoUrl renderiza img tag em vez do texto', () => {
    const r = templates.previewTemplate('welcome', {
      logoUrl: 'https://example.com/logo.png',
    });
    expect(r.html).toContain('https://example.com/logo.png');
    expect(r.html).toContain('alt=');
  });

  it('greeting injeta no topo', () => {
    const r = templates.previewTemplate('order_paid', {
      greeting: 'Bem-vindo à nova era da PCO',
    });
    expect(r.html).toContain('Bem-vindo à nova era da PCO');
  });

  it('orgName aparece no footer', () => {
    const r = templates.previewTemplate('welcome', {
      orgName: 'Minha Escola Custom',
    });
    expect(r.html).toContain('Minha Escola Custom');
  });

  it('footerNote aparece numa div extra acima do footer padrão', () => {
    const r = templates.previewTemplate('order_paid', {
      footerNote: 'Sua matrícula é válida por 12 meses.',
    });
    expect(r.html).toContain('Sua matrícula é válida por 12 meses.');
  });

  it('escape HTML em campos de override', () => {
    const r = templates.previewTemplate('welcome', {
      orgName: '<script>alert(1)</script>',
    });
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('sem override: defaults do AVA preservados', () => {
    const r = templates.previewTemplate('password_reset');
    expect(r.subject).toContain('AVA PCO');
    expect(r.html).toContain('AVA PCO');
  });
});
