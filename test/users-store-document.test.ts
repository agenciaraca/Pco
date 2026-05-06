import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-doc-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.JWT_SECRET = 'test-secret';
  store = await import('../server/auth/users-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('normalizeDocument', () => {
  it('remove pontuação de CPF', () => {
    expect(store.normalizeDocument('123.456.789-00')).toBe('12345678900');
  });

  it('remove pontuação e espaços', () => {
    expect(store.normalizeDocument('  123 456 789 ')).toBe('123456789');
  });

  it('preserva apenas dígitos', () => {
    expect(store.normalizeDocument('CPF: 111.222.333-44')).toBe('11122233344');
  });

  it('retorna vazio para input só com letras', () => {
    expect(store.normalizeDocument('abc')).toBe('');
  });

  it('aceita string vazia', () => {
    expect(store.normalizeDocument('')).toBe('');
  });
});

describe('findUserByDocument', () => {
  it('encontra user com CPF cadastrado igualando dígitos', async () => {
    await store.createUser({
      email: 'doc1@test.com',
      name: 'João',
      role: 'student',
      password: 'pwd-test-123',
      active: true,
      document: '111.222.333-44',
    });
    const found1 = await store.findUserByDocument('11122233344');
    expect(found1).not.toBeNull();
    expect(found1!.email).toBe('doc1@test.com');

    const found2 = await store.findUserByDocument('111.222.333-44');
    expect(found2).not.toBeNull();
    expect(found2!.id).toBe(found1!.id);
  });

  it('retorna null se documento vazio', async () => {
    expect(await store.findUserByDocument('')).toBeNull();
  });

  it('retorna null se nenhum user tem doc', async () => {
    expect(await store.findUserByDocument('999.888.777-66')).toBeNull();
  });

  it('ignora users sem document field', async () => {
    await store.createUser({
      email: 'doc2@test.com',
      name: 'Sem CPF',
      role: 'student',
      password: 'pwd-test-123',
      active: true,
    });
    const found = await store.findUserByDocument('11122233344');
    expect(found!.email).toBe('doc1@test.com');
  });
});
