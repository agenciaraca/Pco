import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let notif: typeof import('../server/repositories/notifications');
let users: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-not-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pwd';
  process.env.INITIAL_ADMIN_PASSWORD = 'a-pwd';
  process.env.INITIAL_STUDENT_PASSWORD = 's-pwd';

  notif = await import('../server/repositories/notifications');
  users = await import('../server/auth/users-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/notifications', () => {
  it('createOne grava com category default info', async () => {
    const n = await notif.createOne({
      userId: 'u-1',
      title: 'Olá',
      body: 'Mensagem',
    });
    expect(n.id).toMatch(/^n-/);
    expect(n.category).toBe('info');
    expect(n.readAt).toBeNull();
  });

  it('listForUser ordena desc + limita', async () => {
    for (let i = 0; i < 5; i++) {
      await notif.createOne({
        userId: 'u-list',
        title: `T${i}`,
        body: 'b',
      });
    }
    const list = await notif.listForUser('u-list');
    expect(list.length).toBe(5);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.createdAt >= list[i]!.createdAt).toBe(true);
    }
    const limited = await notif.listForUser('u-list', 2);
    expect(limited.length).toBe(2);
  });

  it('unreadCountForUser conta só não lidas', async () => {
    await notif.createOne({ userId: 'u-unread', title: 'A', body: 'a' });
    await notif.createOne({ userId: 'u-unread', title: 'B', body: 'b' });
    expect(await notif.unreadCountForUser('u-unread')).toBe(2);
  });

  it('markRead marca readAt; segunda chamada preserva', async () => {
    const n = await notif.createOne({
      userId: 'u-read',
      title: 'X',
      body: 'x',
    });
    expect(await notif.markRead('u-read', n.id)).toBe(true);
    const list = await notif.listForUser('u-read');
    const found = list.find((x) => x.id === n.id);
    expect(found!.readAt).not.toBeNull();
    const firstReadAt = found!.readAt;
    await notif.markRead('u-read', n.id);
    const list2 = await notif.listForUser('u-read');
    expect(list2.find((x) => x.id === n.id)!.readAt).toBe(firstReadAt);
  });

  it('markRead não vaza pra outros users', async () => {
    const n = await notif.createOne({
      userId: 'u-target',
      title: 'T',
      body: 't',
    });
    expect(await notif.markRead('u-other', n.id)).toBe(false);
  });

  it('markAllRead retorna count e zera unread', async () => {
    await notif.createOne({ userId: 'u-all', title: '1', body: '1' });
    await notif.createOne({ userId: 'u-all', title: '2', body: '2' });
    await notif.createOne({ userId: 'u-all', title: '3', body: '3' });
    const count = await notif.markAllRead('u-all');
    expect(count).toBeGreaterThanOrEqual(3);
    expect(await notif.unreadCountForUser('u-all')).toBe(0);
  });

  it('broadcast all atinge todos active users', async () => {
    const sent = await notif.broadcast({
      audience: 'all',
      title: 'Anuncio',
      body: 'Texto',
      category: 'announcement',
      authorEmail: 'admin@pco.local',
    });
    expect(sent).toBeGreaterThan(0);
  });

  it('broadcast students só atinge role=student', async () => {
    const sent = await notif.broadcast({
      audience: 'students',
      title: 'Para alunos',
      body: 'só alunos',
    });
    // Tem 1 student no seed
    expect(sent).toBeGreaterThanOrEqual(1);
  });

  it('broadcast admins atinge admin+superadmin', async () => {
    const sent = await notif.broadcast({
      audience: 'admins',
      title: 'Para admins',
      body: 'aviso',
    });
    // Seed tem 1 admin + 1 superadmin
    expect(sent).toBeGreaterThanOrEqual(2);
  });

  it('broadcast user único', async () => {
    const u = await users.createUser({
      email: 'target@x.com',
      name: 'Target',
      role: 'student',
      password: 'p',
    });
    const sent = await notif.broadcast({
      audience: 'user',
      userId: u.id,
      title: 'só pra você',
      body: 'msg',
    });
    expect(sent).toBe(1);
    const list = await notif.listForUser(u.id);
    expect(list.some((n) => n.title === 'só pra você')).toBe(true);
  });

  it('broadcast users (lista) só pega os ids dados', async () => {
    const a = await users.createUser({
      email: 'multi-a@x.com',
      name: 'A',
      role: 'student',
      password: 'p',
    });
    const b = await users.createUser({
      email: 'multi-b@x.com',
      name: 'B',
      role: 'student',
      password: 'p',
    });
    const sent = await notif.broadcast({
      audience: 'users',
      userIds: [a.id, b.id],
      title: 'multi',
      body: 'msg',
    });
    expect(sent).toBe(2);
  });

  it('broadcast user não-existe retorna 0', async () => {
    const sent = await notif.broadcast({
      audience: 'user',
      userId: 'nada',
      title: 'X',
      body: 'X',
    });
    expect(sent).toBe(0);
  });

  it('listSentBroadcasts agrupa por (title, authorEmail, minuto)', async () => {
    await notif.broadcast({
      audience: 'admins',
      title: 'Agrupa-me',
      body: 'xxx',
      authorEmail: 'admin@pco.local',
    });
    const groups = await notif.listSentBroadcasts();
    const found = groups.find((g) => g.title === 'Agrupa-me');
    expect(found).toBeDefined();
    expect(found!.recipientsCount).toBeGreaterThanOrEqual(2);
    expect(found!.authorEmail).toBe('admin@pco.local');
  });
});
