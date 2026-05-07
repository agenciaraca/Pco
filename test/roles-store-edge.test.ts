import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let roles: typeof import('../server/auth/roles-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-roles-edge-'));
  process.env.DATA_DIR = tmpDir;
  roles = await import('../server/auth/roles-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await roles._resetForTests();
});

describe('roles-store edge cases', () => {
  it('slug com chars unicode é preservado se cair no regex normalizado', async () => {
    // Letras acentuadas viram '-' pelo normalize; mas underscore é mantido
    const r = await roles.createRole({ slug: 'tutor_senior', name: 'T' });
    expect(r.slug).toBe('tutor_senior');
  });

  it('description default vazia quando não passada', async () => {
    const r = await roles.createRole({ slug: 'desc-test', name: 'D' });
    expect(r.description).toBe('');
  });

  it('description recebe trim', async () => {
    const r = await roles.createRole({
      slug: 'trim',
      name: 'T',
      description: '   com espaços   ',
    });
    expect(r.description).toBe('com espaços');
  });

  it('listPermissions com store fresh: custom vazio', async () => {
    const cat = await roles.listPermissions();
    expect(cat.custom).toEqual([]);
    expect(cat.system.length).toBeGreaterThanOrEqual(80);
  });

  it('updateRole sem campos: apenas updatedAt muda', async () => {
    const r = await roles.createRole({ slug: 'noop', name: 'N' });
    const beforeUpd = r.updatedAt;
    await new Promise((res) => setTimeout(res, 5));
    const u = await roles.updateRole(r.id, {});
    expect(u.name).toBe('N');
    expect(u.permissions).toEqual([]);
    expect(u.updatedAt).not.toBe(beforeUpd);
  });

  it('updateRole valida permissions inválidas', async () => {
    const r = await roles.createRole({ slug: 'val', name: 'V' });
    await expect(
      roles.updateRole(r.id, { permissions: ['Has Spaces!'] }),
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION' });
  });

  it('updateRole permite limpar permissions (array vazio)', async () => {
    const r = await roles.createRole({
      slug: 'clear',
      name: 'C',
      permissions: ['analytics.read'],
    });
    const u = await roles.updateRole(r.id, { permissions: [] });
    expect(u.permissions).toEqual([]);
  });

  it('createRole rejeita slug com >40 chars (trunca normalize)', async () => {
    const longSlug = 'a'.repeat(50);
    await expect(
      roles.createRole({ slug: longSlug, name: 'L' }),
    ).rejects.toMatchObject({ code: 'INVALID_SLUG' });
  });

  it('PERMISSION_META cobre todas as SYSTEM_PERMISSIONS', async () => {
    const cat = await roles.listPermissions();
    for (const p of cat.system) {
      expect(cat.meta[p], `falta meta para ${p}`).toBeDefined();
      expect(cat.meta[p].label).toBeTruthy();
      expect(cat.meta[p].group).toBeTruthy();
    }
  });

  it('PERMISSION_GROUPS contém Outros como fallback', async () => {
    const cat = await roles.listPermissions();
    expect(cat.groups).toContain('Outros');
  });

  it('createRole com tier custom propaga corretamente', async () => {
    const r = await roles.createRole({
      slug: 'with-tier',
      name: 'WT',
      tier: 'admin',
    });
    expect(r.tier).toBe('admin');
  });
});
