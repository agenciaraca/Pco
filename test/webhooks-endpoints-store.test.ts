import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/webhooks/endpoints-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-whe-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  store = await import('../server/webhooks/endpoints-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('webhooks/endpoints-store', () => {
  it('createEndpoint cria com defaults + esconde secret na view pública', async () => {
    const e = await store.createEndpoint({
      name: 'Slack #vendas',
      url: 'https://hooks.slack.com/services/AAA/BBB',
      events: ['order.paid'],
      secret: 'webhook-secret-123',
      headers: { 'x-custom': 'y' },
    });
    expect(e.id).toMatch(/^wh-/);
    expect(e.enabled).toBe(true);
    expect(e.channelType).toBe('generic');
    expect(e.hasSecret).toBe(true);
    expect(e.hasHeaders).toBe(true);
    expect((e as Record<string, unknown>).secretEncrypted).toBeUndefined();
    expect((e as Record<string, unknown>).headersEncrypted).toBeUndefined();
  });

  it('decryptEndpoint round-trip secret + headers JSON', async () => {
    const created = await store.createEndpoint({
      name: 'enc',
      url: 'https://x',
      events: ['order.paid'],
      secret: 'super-secret',
      headers: { authorization: 'Bearer xyz', 'x-tag': 'prod' },
    });
    const raw = await store.getEndpoint(created.id);
    expect(raw!.secretEncrypted).not.toBe('super-secret');
    const decoded = store.decryptEndpoint(raw!);
    expect(decoded.secret).toBe('super-secret');
    expect(decoded.headers).toEqual({
      authorization: 'Bearer xyz',
      'x-tag': 'prod',
    });
  });

  it('listForEvent só retorna enabled + matching event', async () => {
    await store.createEndpoint({
      name: 'A',
      url: 'https://a',
      events: ['order.paid', 'order.refunded'],
    });
    await store.createEndpoint({
      name: 'B disabled',
      url: 'https://b',
      events: ['order.paid'],
      enabled: false,
    });
    await store.createEndpoint({
      name: 'C wrong event',
      url: 'https://c',
      events: ['enrollment.created'],
    });
    const matching = await store.listForEvent('order.paid');
    const names = matching.map((e) => e.name);
    expect(names).toContain('A');
    expect(names).not.toContain('B disabled');
    expect(names).not.toContain('C wrong event');
  });

  it('updateEndpoint preserva secret quando patch.secret undefined', async () => {
    const e = await store.createEndpoint({
      name: 'preserva',
      url: 'https://x',
      events: ['order.paid'],
      secret: 'orig-secret',
    });
    await store.updateEndpoint(e.id, { name: 'renomeado' });
    const raw = await store.getEndpoint(e.id);
    const dec = store.decryptEndpoint(raw!);
    expect(dec.secret).toBe('orig-secret');
  });

  it('updateEndpoint com secret novo rotaciona', async () => {
    const e = await store.createEndpoint({
      name: 'rot',
      url: 'https://x',
      events: ['order.paid'],
      secret: 'old',
    });
    await store.updateEndpoint(e.id, { secret: 'novo-segredo' });
    const raw = await store.getEndpoint(e.id);
    const dec = store.decryptEndpoint(raw!);
    expect(dec.secret).toBe('novo-segredo');
  });

  it('updateEndpoint com secret="" preserva (não rotaciona pra empty)', async () => {
    const e = await store.createEndpoint({
      name: 'empty',
      url: 'https://x',
      events: ['order.paid'],
      secret: 'orig',
    });
    await store.updateEndpoint(e.id, { secret: '' });
    const raw = await store.getEndpoint(e.id);
    const dec = store.decryptEndpoint(raw!);
    expect(dec.secret).toBe('orig');
  });

  it('recordSuccess + recordFailure', async () => {
    const e = await store.createEndpoint({
      name: 'metrics',
      url: 'https://x',
      events: ['order.paid'],
    });
    await store.recordSuccess(e.id);
    let raw = await store.getEndpoint(e.id);
    expect(raw!.lastSuccessAt).toBeDefined();

    await store.recordFailure(e.id, 'connection refused');
    raw = await store.getEndpoint(e.id);
    expect(raw!.lastFailureAt).toBeDefined();
    expect(raw!.lastErrorMessage).toBe('connection refused');
  });

  it('recordFailure trunca mensagem em 500 chars', async () => {
    const e = await store.createEndpoint({
      name: 'long-err',
      url: 'https://x',
      events: ['order.paid'],
    });
    const huge = 'x'.repeat(2000);
    await store.recordFailure(e.id, huge);
    const raw = await store.getEndpoint(e.id);
    expect(raw!.lastErrorMessage!.length).toBe(500);
  });

  it('deleteEndpoint remove + retorna false em segunda', async () => {
    const e = await store.createEndpoint({
      name: 'del',
      url: 'https://x',
      events: ['order.paid'],
    });
    expect(await store.deleteEndpoint(e.id)).toBe(true);
    expect(await store.deleteEndpoint(e.id)).toBe(false);
    expect(await store.getEndpoint(e.id)).toBeNull();
  });

  it('listEndpoints retorna views públicas', async () => {
    const list = await store.listEndpoints();
    for (const e of list) {
      expect((e as Record<string, unknown>).secretEncrypted).toBeUndefined();
      expect((e as Record<string, unknown>).headersEncrypted).toBeUndefined();
    }
  });
});
