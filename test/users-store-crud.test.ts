import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-users-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pass-1234';
  process.env.INITIAL_ADMIN_PASSWORD = 'admin-pass-1234';
  process.env.INITIAL_STUDENT_PASSWORD = 'student-pass-1234';
  store = await import('../server/auth/users-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('auth/users-store CRUD', () => {
  it('seedy 3 default users (superadmin/admin/student)', async () => {
    const list = await store.listUsers();
    const roles = list.map((u) => u.role).sort();
    expect(roles).toContain('superadmin');
    expect(roles).toContain('admin');
    expect(roles).toContain('student');
  });

  it('toPublic remove passwordHash, totpSecretEncrypted, totpBackupCodes', async () => {
    const list = await store.listUsers();
    for (const u of list) {
      const plain = u as unknown as Record<string, unknown>;
      expect(plain.passwordHash).toBeUndefined();
      expect(plain.totpSecretEncrypted).toBeUndefined();
      expect(plain.totpBackupCodes).toBeUndefined();
    }
  });

  it('createUser hash bcrypt + email único', async () => {
    const u = await store.createUser({
      email: 'novo@x.com',
      name: 'Novo',
      role: 'student',
      password: 'minha-senha-123',
    });
    expect(u.email).toBe('novo@x.com');
    expect(u.tokenVersion).toBe(0);
    expect(u.active).toBe(true);
    // duplicidade dispara erro
    await expect(
      store.createUser({
        email: 'novo@x.com',
        name: 'Outro',
        role: 'student',
        password: 'x',
      }),
    ).rejects.toThrow(/Já existe/);
  });

  it('verifyPassword: senha correta + senha errada', async () => {
    await store.createUser({
      email: 'login@x.com',
      name: 'Login',
      role: 'student',
      password: 'senha-correta',
    });
    expect(await store.verifyPassword('login@x.com', 'senha-correta')).not.toBeNull();
    expect(await store.verifyPassword('login@x.com', 'senha-errada')).toBeNull();
  });

  it('verifyPassword rejeita user inactive', async () => {
    const u = await store.createUser({
      email: 'inactive@x.com',
      name: 'Inactive',
      role: 'student',
      password: 'pwd',
    });
    await store.updateUser(u.id, { active: false });
    expect(await store.verifyPassword('inactive@x.com', 'pwd')).toBeNull();
  });

  it('updateUser desativando bumpa tokenVersion', async () => {
    const u = await store.createUser({
      email: 'tv-deact@x.com',
      name: 'TV',
      role: 'student',
      password: 'pwd',
    });
    expect(u.tokenVersion).toBe(0);
    const updated = await store.updateUser(u.id, { active: false });
    expect(updated!.tokenVersion).toBe(1);
  });

  it('updateUser email duplicado lança', async () => {
    const a = await store.createUser({
      email: 'aa@x.com',
      name: 'A',
      role: 'student',
      password: 'pwd',
    });
    await store.createUser({
      email: 'bb@x.com',
      name: 'B',
      role: 'student',
      password: 'pwd',
    });
    await expect(store.updateUser(a.id, { email: 'bb@x.com' })).rejects.toThrow(
      /Já existe/,
    );
  });

  it('verifyAndChangePassword: ok + wrong-password + not-found', async () => {
    const u = await store.createUser({
      email: 'changepwd@x.com',
      name: 'CP',
      role: 'student',
      password: 'old-pwd',
    });
    expect(await store.verifyAndChangePassword(u.id, 'wrong', 'new')).toBe(
      'wrong-password',
    );
    expect(await store.verifyAndChangePassword(u.id, 'old-pwd', 'new-pwd')).toBe(
      'ok',
    );
    expect(await store.verifyAndChangePassword('nao-existe', 'x', 'y')).toBe(
      'not-found',
    );
    // login com senha nova
    expect(await store.verifyPassword('changepwd@x.com', 'new-pwd')).not.toBeNull();
  });

  it('changePassword bumpa tokenVersion', async () => {
    const u = await store.createUser({
      email: 'cp-tv@x.com',
      name: 'CP-TV',
      role: 'student',
      password: 'pwd',
    });
    const before = u.tokenVersion;
    await store.changePassword(u.id, 'novissima');
    const after = await store.findUserById(u.id);
    expect(after!.tokenVersion).toBe(before + 1);
  });

  it('bumpTokenVersion incrementa', async () => {
    const u = await store.createUser({
      email: 'bump@x.com',
      name: 'Bump',
      role: 'student',
      password: 'pwd',
    });
    const v1 = await store.bumpTokenVersion(u.id);
    const v2 = await store.bumpTokenVersion(u.id);
    expect(v2).toBe(v1! + 1);
  });

  it('bumpTokenVersion retorna null pra user inexistente', async () => {
    expect(await store.bumpTokenVersion('nao-existe')).toBeNull();
  });

  it('findUserByEmail é case-insensitive', async () => {
    await store.createUser({
      email: 'mixedcase@x.com',
      name: 'MC',
      role: 'student',
      password: 'pwd',
    });
    expect(await store.findUserByEmail('MIXEDCASE@X.COM')).not.toBeNull();
    expect(await store.findUserByEmail('MixedCase@x.com')).not.toBeNull();
  });

  it('deleteUser remove + protege último superadmin', async () => {
    const u = await store.createUser({
      email: 'del@x.com',
      name: 'D',
      role: 'student',
      password: 'pwd',
    });
    expect(await store.deleteUser(u.id)).toBe(true);
    expect(await store.findUserById(u.id)).toBeNull();

    // tenta deletar o único superadmin → erro
    const list = await store.listUsers();
    const sa = list.find((x) => x.role === 'superadmin');
    await expect(store.deleteUser(sa!.id)).rejects.toThrow(/superadmin/);
  });

  it('normalizeDocument tira pontuação', () => {
    expect(store.normalizeDocument('123.456.789-00')).toBe('12345678900');
    expect(store.normalizeDocument('  111  222 ')).toBe('111222');
    expect(store.normalizeDocument('abc')).toBe('');
  });

  it('generatePassword tem comprimento e charset esperados', () => {
    const p = store.generatePassword(20);
    expect(p).toHaveLength(20);
    expect(/^[a-zA-Z0-9!@#%*\-_+=]+$/.test(p)).toBe(true);
  });
});
