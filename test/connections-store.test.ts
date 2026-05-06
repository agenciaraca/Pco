import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/imports/connections-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-conn-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  store = await import('../server/imports/connections-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('connections-store create + decrypt', () => {
  it('cria conexão e listAll', async () => {
    const c = await store.createConnection({
      name: 'Site A',
      siteUrl: 'https://exemplo.com',
      wpUsername: 'admin',
      wpAppPassword: 'plain-secret-123',
    });
    expect(c.name).toBe('Site A');
    expect(c.hasWpAppPassword).toBe(true);
    expect(c.hasWcConsumerKey).toBe(false);
    const all = await store.listConnections();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('normaliza URL adicionando https', async () => {
    const c = await store.createConnection({
      name: 'Sem proto',
      siteUrl: 'meusite.com.br',
    });
    expect(c.siteUrl).toBe('https://meusite.com.br');
  });

  it('remove trailing slash do siteUrl', async () => {
    const c = await store.createConnection({
      name: 'Trailing',
      siteUrl: 'https://abc.com///',
    });
    expect(c.siteUrl).toBe('https://abc.com');
  });

  it('decryptCreds devolve senha plain', async () => {
    const created = await store.createConnection({
      name: 'Decrypt',
      siteUrl: 'https://decrypt.com',
      wpUsername: 'me',
      wpAppPassword: 'super-secret-abc',
      wcConsumerKey: 'ck_test_xyz',
      wcConsumerSecret: 'cs_test_abc',
    });
    const internal = await store.getConnection(created.id);
    expect(internal).not.toBeNull();
    const creds = store.decryptCreds(internal!);
    expect(creds.wpAppPassword).toBe('super-secret-abc');
    expect(creds.wcConsumerKey).toBe('ck_test_xyz');
    expect(creds.wcConsumerSecret).toBe('cs_test_abc');
  });

  it('persiste defaults (matchKeys, conflictStrategy)', async () => {
    const c = await store.createConnection({
      name: 'Defaults',
      siteUrl: 'https://defaults.com',
      defaultUserMatchKeys: ['email', 'document'],
      defaultConflictStrategy: 'merge',
    });
    expect(c.defaultUserMatchKeys).toEqual(['email', 'document']);
    expect(c.defaultConflictStrategy).toBe('merge');
  });

  it('updateConnection mantém senha quando patch é vazio/undefined', async () => {
    const created = await store.createConnection({
      name: 'KeepPwd',
      siteUrl: 'https://keep.com',
      wpAppPassword: 'original-pwd',
    });
    await store.updateConnection(created.id, { name: 'NewName' });
    const refetch = await store.getConnection(created.id);
    const creds = store.decryptCreds(refetch!);
    expect(refetch!.name).toBe('NewName');
    expect(creds.wpAppPassword).toBe('original-pwd');
  });

  it('updateConnection com senha nova substitui', async () => {
    const created = await store.createConnection({
      name: 'NewPwd',
      siteUrl: 'https://newpwd.com',
      wpAppPassword: 'old-pwd',
    });
    await store.updateConnection(created.id, { wpAppPassword: 'new-pwd-xyz' });
    const refetch = await store.getConnection(created.id);
    const creds = store.decryptCreds(refetch!);
    expect(creds.wpAppPassword).toBe('new-pwd-xyz');
  });

  it('deleteConnection remove', async () => {
    const c = await store.createConnection({
      name: 'ToDelete',
      siteUrl: 'https://del.com',
    });
    const ok = await store.deleteConnection(c.id);
    expect(ok).toBe(true);
    const after = await store.getConnection(c.id);
    expect(after).toBeNull();
  });
});
