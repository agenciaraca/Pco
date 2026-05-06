import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let repo: typeof import('../server/payments/gateways-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-gw-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  repo = await import('../server/payments/gateways-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('gateways-repo', () => {
  it('createGateway encripta apiKey/apiSecret', async () => {
    const g = await repo.createGateway({
      provider: 'stripe',
      displayName: 'Stripe Test',
      mode: 'test',
      apiKey: 'sk_test_xxx',
      apiSecret: 'whsec_yyy',
    });
    expect(g.id).toMatch(/^gw-/);
    expect(g.provider).toBe('stripe');
    expect(g.active).toBe(false);
    // apiKey é exposto apenas como hasApiKey: true
    expect(g.hasApiKey).toBe(true);
    expect(g.hasApiSecret).toBe(true);
    // Não deve retornar plain
    expect((g as { apiKey?: string }).apiKey).toBeUndefined();
  });

  it('getDecryptedCredentials retorna apiKey/apiSecret plain', async () => {
    const g = await repo.createGateway({
      provider: 'mercadopago',
      displayName: 'MP Test',
      mode: 'test',
      apiKey: 'TEST-1234',
      apiSecret: 'sec-99',
    });
    const creds = await repo.getDecryptedCredentials(g.id);
    expect(creds!.apiKey).toBe('TEST-1234');
    expect(creds!.apiSecret).toBe('sec-99');
  });

  it('updateGateway com apiKey vazio MANTÉM antigo', async () => {
    const g = await repo.createGateway({
      provider: 'mock',
      displayName: 'Mock',
      mode: 'test',
      apiKey: 'original-key',
    });
    await repo.updateGateway(g.id, { apiKey: '', displayName: 'Renamed' });
    const creds = await repo.getDecryptedCredentials(g.id);
    expect(creds!.apiKey).toBe('original-key');
    const list = await repo.listAll();
    const found = list.find((x) => x.id === g.id);
    expect(found!.displayName).toBe('Renamed');
  });

  it('updateGateway com novo apiKey substitui', async () => {
    const g = await repo.createGateway({
      provider: 'asaas',
      displayName: 'Asaas',
      mode: 'test',
      apiKey: 'old-key',
    });
    await repo.updateGateway(g.id, { apiKey: 'new-key' });
    const creds = await repo.getDecryptedCredentials(g.id);
    expect(creds!.apiKey).toBe('new-key');
  });

  it('listActive filtra apenas active=true', async () => {
    await repo.createGateway({
      provider: 'pagarme',
      displayName: 'Active',
      mode: 'live',
      apiKey: 'k',
      active: true,
    });
    const active = await repo.listActive();
    expect(active.every((g) => g.active)).toBe(true);
    expect(active.length).toBeGreaterThan(0);
  });

  it('deleteGateway remove', async () => {
    const g = await repo.createGateway({
      provider: 'paypal',
      displayName: 'ToDel',
      mode: 'test',
      apiKey: 'k',
    });
    const ok = await repo.deleteGateway(g.id);
    expect(ok).toBe(true);
    expect(await repo.findById(g.id)).toBeNull();
  });
});
