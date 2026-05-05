import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/auth/deletion-requests-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-del-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/auth/deletion-requests-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('deletion-requests-store', () => {
  it('cria solicitação pending', async () => {
    const r = await store.create({
      userId: 'u1',
      userEmail: 'u1@test.com',
      reason: 'Não quero mais',
    });
    expect(r.status).toBe('pending');
    expect(r.userId).toBe('u1');
    expect(r.reason).toBe('Não quero mais');
  });

  it('rejeita 2ª solicitação ativa para mesmo user', async () => {
    await expect(
      store.create({ userId: 'u1', userEmail: 'u1@test.com' }),
    ).rejects.toThrow(/Já existe/);
  });

  it('findActiveForUser retorna pending/approved', async () => {
    const r = await store.findActiveForUser('u1');
    expect(r).not.toBeNull();
    expect(r!.status).toBe('pending');
  });

  it('cancel marca como rejected', async () => {
    const active = await store.findActiveForUser('u1');
    const ok = await store.cancel(active!.id, 'u1');
    expect(ok).toBe(true);
    const after = await store.findActiveForUser('u1');
    expect(after).toBeNull();
  });

  it('permite nova solicitação após cancel', async () => {
    const r = await store.create({ userId: 'u1', userEmail: 'u1@test.com' });
    expect(r.status).toBe('pending');
  });

  it('admin setStatus para approved', async () => {
    const active = await store.findActiveForUser('u1');
    const r = await store.setStatus(
      active!.id,
      'approved',
      'admin@test.com',
      'aprovado',
    );
    expect(r!.status).toBe('approved');
    expect(r!.resolvedBy).toBe('admin@test.com');
  });

  it('listAll retorna ordenado desc por requestedAt', async () => {
    await store.create({ userId: 'u2', userEmail: 'u2@test.com' });
    const all = await store.listAll();
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.requestedAt >= all[i]!.requestedAt).toBe(true);
    }
  });

  it('cancel não permite cancelar solicitação de outro user', async () => {
    const active = await store.findActiveForUser('u2');
    expect(active).not.toBeNull();
    const ok = await store.cancel(active!.id, 'outro-user');
    expect(ok).toBe(false);
  });
});
