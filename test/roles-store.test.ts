import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let roles: typeof import('../server/auth/roles-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-roles-'));
  process.env.DATA_DIR = tmpDir;
  roles = await import('../server/auth/roles-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await roles._resetForTests();
});

describe('roles-store', () => {
  describe('listRoles', () => {
    it('inicia com 3 system roles seed', async () => {
      const all = await roles.listRoles();
      expect(all).toHaveLength(3);
      expect(all.map((r) => r.slug).sort()).toEqual(
        ['admin', 'student', 'superadmin'].sort(),
      );
    });

    it('system roles vêm primeiro', async () => {
      await roles.createRole({ slug: 'mentor', name: 'Mentor' });
      const all = await roles.listRoles();
      expect(all.slice(0, 3).every((r) => r.system)).toBe(true);
      expect(all[3].system).toBe(false);
    });

    it('superadmin tem todas as permissions', async () => {
      const all = await roles.listRoles();
      const sa = all.find((r) => r.slug === 'superadmin')!;
      expect(sa.permissions).toEqual([...roles.SYSTEM_PERMISSIONS]);
    });
  });

  describe('createRole', () => {
    it('cria role custom com slug normalizado', async () => {
      const r = await roles.createRole({
        slug: 'Tutor Senior!',
        name: 'Tutor Sênior',
        description: 'Pode responder no tutor',
      });
      expect(r.slug).toBe('tutor-senior');
      expect(r.system).toBe(false);
      expect(r.id).toMatch(/^role-/);
    });

    it('rejeita slug inválido (curto)', async () => {
      await expect(
        roles.createRole({ slug: 'a', name: 'X' }),
      ).rejects.toThrow(/slug/i);
    });

    it('rejeita nome vazio', async () => {
      await expect(
        roles.createRole({ slug: 'novo', name: '' }),
      ).rejects.toThrow(/nome/i);
    });

    it('rejeita slug duplicado', async () => {
      await roles.createRole({ slug: 'mentor', name: 'Mentor' });
      await expect(
        roles.createRole({ slug: 'mentor', name: 'Outro' }),
      ).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
    });

    it('rejeita slug colidindo com system role', async () => {
      await expect(
        roles.createRole({ slug: 'admin', name: 'Falso admin' }),
      ).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
    });

    it('valida formato das permissions', async () => {
      await expect(
        roles.createRole({
          slug: 'bad',
          name: 'Bad',
          permissions: ['Has Spaces'],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PERMISSION' });
    });

    it('aceita custom permissions com formato válido', async () => {
      const r = await roles.createRole({
        slug: 'custom',
        name: 'Custom',
        permissions: ['custom.action', 'analytics.read'],
      });
      expect(r.permissions).toEqual(['custom.action', 'analytics.read']);
    });

    it('deduplica permissions', async () => {
      const r = await roles.createRole({
        slug: 'dup',
        name: 'Dup',
        permissions: ['analytics.read', 'analytics.read'],
      });
      expect(r.permissions).toEqual(['analytics.read']);
    });
  });

  describe('updateRole', () => {
    it('atualiza name/description/permissions', async () => {
      const r = await roles.createRole({ slug: 'mentor', name: 'M' });
      const updated = await roles.updateRole(r.id, {
        name: 'Mentor v2',
        description: 'Atualizado',
        permissions: ['support.read'],
      });
      expect(updated.name).toBe('Mentor v2');
      expect(updated.description).toBe('Atualizado');
      expect(updated.permissions).toEqual(['support.read']);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(r.updatedAt).getTime(),
      );
    });

    it('rejeita update em system role', async () => {
      const all = await roles.listRoles();
      const admin = all.find((r) => r.slug === 'admin')!;
      await expect(
        roles.updateRole(admin.id, { name: 'Outro nome' }),
      ).rejects.toMatchObject({ code: 'SYSTEM_ROLE' });
    });

    it('rejeita NOT_FOUND', async () => {
      await expect(
        roles.updateRole('role-inexistente', { name: 'X' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('deleteRole', () => {
    it('deleta role custom', async () => {
      const r = await roles.createRole({ slug: 'tmp', name: 'T' });
      await roles.deleteRole(r.id);
      const all = await roles.listRoles();
      expect(all.find((x) => x.id === r.id)).toBeUndefined();
    });

    it('rejeita delete em system role', async () => {
      const all = await roles.listRoles();
      const stu = all.find((r) => r.slug === 'student')!;
      await expect(roles.deleteRole(stu.id)).rejects.toMatchObject({
        code: 'SYSTEM_ROLE',
      });
    });
  });

  describe('listPermissions', () => {
    it('retorna catálogo system + custom encontradas', async () => {
      await roles.createRole({
        slug: 'lab',
        name: 'Lab',
        permissions: ['lab.experimental', 'analytics.read'],
      });
      const cat = await roles.listPermissions();
      expect(cat.system).toEqual([...roles.SYSTEM_PERMISSIONS]);
      expect(cat.custom).toContain('lab.experimental');
      expect(cat.custom).not.toContain('analytics.read');
    });
  });

  describe('findBySlug', () => {
    it('encontra role por slug normalizado', async () => {
      await roles.createRole({ slug: 'Mentor 1', name: 'M' });
      const r = await roles.findBySlug('Mentor-1');
      expect(r?.slug).toBe('mentor-1');
    });
  });
});
