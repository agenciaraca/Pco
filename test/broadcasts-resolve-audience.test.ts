import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let broadcasts: typeof import('../server/notifications/broadcasts');
let users: typeof import('../server/auth/users-store');

// Timeout maior — bcrypt hash em users.createUser é lento sob coverage instrumentation
beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-bd-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pwd';
  process.env.INITIAL_ADMIN_PASSWORD = 'a-pwd';
  process.env.INITIAL_STUDENT_PASSWORD = 's-pwd';
  delete process.env.DATABASE_URL;

  broadcasts = await import('../server/notifications/broadcasts');
  users = await import('../server/auth/users-store');

  // Seed extras
  await users.createUser({
    email: 'extra1@x.com',
    name: 'Extra 1',
    role: 'student',
    password: 'p',
  });
  await users.createUser({
    email: 'extra2@x.com',
    name: 'Extra 2',
    role: 'student',
    password: 'p',
  });
}, 30_000);

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('broadcasts/resolveAudience', () => {
  it('audience=all retorna todos active users', async () => {
    const list = await broadcasts.resolveAudience('all');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.email.includes('@'))).toBe(true);
  });

  it('audience=admins só retorna admin/superadmin', async () => {
    const list = await broadcasts.resolveAudience('admins');
    // Default seed tem 1 admin + 1 superadmin
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((r) => r.email.endsWith('@pco.local'))).toBe(true);
  });

  it('audience=students_active só retorna students', async () => {
    const list = await broadcasts.resolveAudience('students_active');
    // pco.local seed (1) + extras (2) = pelo menos 3
    expect(list.length).toBeGreaterThanOrEqual(3);
  });

  it('audience=enrolled_in_course sem courseId retorna []', async () => {
    const list = await broadcasts.resolveAudience('enrolled_in_course');
    expect(list).toEqual([]);
  });

  it('audience=students_inactive sem inactivityDays retorna []', async () => {
    const list = await broadcasts.resolveAudience('students_inactive');
    expect(list).toEqual([]);
  });

  it('audience desconhecida retorna []', async () => {
    const list = await broadcasts.resolveAudience(
      'qualquer_coisa' as Parameters<typeof broadcasts.resolveAudience>[0],
    );
    expect(list).toEqual([]);
  });

  it('exclui users inactive', async () => {
    const u = await users.createUser({
      email: 'desativado@x.com',
      name: 'Desat',
      role: 'student',
      password: 'p',
    });
    await users.updateUser(u.id, { active: false });
    const list = await broadcasts.resolveAudience('all');
    expect(list.find((r) => r.email === 'desativado@x.com')).toBeUndefined();
  });

  it('listBroadcasts inicia vazio + ordena desc por createdAt', async () => {
    const list = await broadcasts.listBroadcasts();
    expect(Array.isArray(list)).toBe(true);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.createdAt >= list[i]!.createdAt).toBe(true);
    }
  });
});
