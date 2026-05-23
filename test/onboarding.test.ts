import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-onboarding-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pass-1234';
  process.env.INITIAL_ADMIN_PASSWORD = 'admin-pass-1234';
  process.env.INITIAL_STUDENT_PASSWORD = 'student-pass-1234';
  store = await import('../server/auth/users-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('onboarding', () => {
  describe('SystemUser.onboardingCompletedAt', () => {
    it('novos usuários não têm onboardingCompletedAt', async () => {
      const users = await store.listUsers();
      const admin = users.find((u) => u.role === 'admin');
      expect(admin).toBeDefined();
      expect(admin!.onboardingCompletedAt).toBeUndefined();
    });

    it('updateUser aceita onboardingCompletedAt', async () => {
      const users = await store.listUsers();
      const admin = users.find((u) => u.role === 'admin')!;
      const now = new Date().toISOString();
      const updated = await store.updateUser(admin.id, {
        onboardingCompletedAt: now,
      });
      expect(updated).not.toBeNull();
      expect(updated!.onboardingCompletedAt).toBe(now);
    });

    it('findById retorna onboardingCompletedAt persistido', async () => {
      const users = await store.listUsers();
      const admin = users.find((u) => u.role === 'admin')!;
      const found = await store.findUserById(admin.id);
      expect(found).not.toBeNull();
      expect(found!.onboardingCompletedAt).toBeTruthy();
    });

    it('onboardingCompletedAt pode ser resetado para null', async () => {
      const users = await store.listUsers();
      const admin = users.find((u) => u.role === 'admin')!;
      const updated = await store.updateUser(admin.id, {
        onboardingCompletedAt: null,
      });
      expect(updated).not.toBeNull();
      expect(updated!.onboardingCompletedAt).toBeNull();
    });
  });

  describe('createUser sem onboarding', () => {
    it('usuário criado não tem onboardingCompletedAt', async () => {
      const created = await store.createUser({
        email: 'coord-test@pco.online',
        name: 'Coordenador Teste',
        role: 'admin',
        password: 'coord-pass-1234',
      });
      expect(created.onboardingCompletedAt).toBeUndefined();
    });
  });

  describe('toPublic inclui onboardingCompletedAt', () => {
    it('campo visível no retorno público', async () => {
      const users = await store.listUsers();
      const coord = users.find((u) => u.email === 'coord-test@pco.online')!;
      await store.updateUser(coord.id, {
        onboardingCompletedAt: '2026-05-23T10:00:00Z',
      });
      const list = await store.listUsers();
      const updated = list.find((u) => u.email === 'coord-test@pco.online')!;
      expect(updated.onboardingCompletedAt).toBe('2026-05-23T10:00:00Z');
    });
  });
});
