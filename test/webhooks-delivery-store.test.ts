import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/webhooks/delivery-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-whd-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/webhooks/delivery-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('webhooks/delivery-store', () => {
  it('create inicializa pending com attempts=0', async () => {
    const d = await store.create({
      endpointId: 'ep-1',
      event: 'order.paid',
      payload: { orderId: 'o-1' },
    });
    expect(d.id).toMatch(/^whd-/);
    expect(d.status).toBe('pending');
    expect(d.attempts).toBe(0);
    expect(d.createdAt).toBe(d.updatedAt);
    expect(d.nextAttemptAt).toBe(d.createdAt);
  });

  it('listAll ordena desc por createdAt', async () => {
    await store.create({
      endpointId: 'ep-2',
      event: 'order.paid',
      payload: {},
    });
    await new Promise((r) => setTimeout(r, 10));
    const last = await store.create({
      endpointId: 'ep-2',
      event: 'order.paid',
      payload: {},
    });
    const list = await store.listAll();
    expect(list[0]!.id).toBe(last.id);
  });

  it('listByEndpoint filtra', async () => {
    await store.create({
      endpointId: 'ep-A',
      event: 'order.paid',
      payload: {},
    });
    await store.create({
      endpointId: 'ep-B',
      event: 'order.paid',
      payload: {},
    });
    const a = await store.listByEndpoint('ep-A');
    expect(naoVazio(a).every((d) => d.endpointId === 'ep-A')).toBe(true);
  });

  it('markAttempt incrementa attempts e ajusta status', async () => {
    const d = await store.create({
      endpointId: 'ep-attempt',
      event: 'order.paid',
      payload: {},
    });
    await store.markAttempt(d.id, {
      status: 'success',
      lastResponseStatus: 200,
      completedAt: new Date().toISOString(),
    });
    const after = await store.findById(d.id);
    expect(after!.attempts).toBe(1);
    expect(after!.status).toBe('success');
    expect(after!.lastResponseStatus).toBe(200);
    expect(after!.completedAt).toBeDefined();
  });

  it('markAttempt em failed grava lastError + nextAttemptAt', async () => {
    const d = await store.create({
      endpointId: 'ep-fail',
      event: 'order.paid',
      payload: {},
    });
    const next = new Date(Date.now() + 60_000).toISOString();
    await store.markAttempt(d.id, {
      status: 'retrying',
      lastError: 'connection refused',
      nextAttemptAt: next,
    });
    const after = await store.findById(d.id);
    expect(after!.status).toBe('retrying');
    expect(after!.lastError).toBe('connection refused');
    expect(after!.nextAttemptAt).toBe(next);
  });

  it('pending retorna apenas pending/retrying com nextAttemptAt no passado', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();

    const ready = await store.create({
      endpointId: 'ep-pend',
      event: 'order.paid',
      payload: {},
    });
    // ready: nextAttemptAt no passado
    await store.markAttempt(ready.id, {
      status: 'pending',
      nextAttemptAt: past,
    });

    const notReady = await store.create({
      endpointId: 'ep-pend',
      event: 'order.paid',
      payload: {},
    });
    await store.markAttempt(notReady.id, {
      status: 'pending',
      nextAttemptAt: future,
    });

    const list = await store.pending();
    expect(list.some((d) => d.id === ready.id)).toBe(true);
    expect(list.some((d) => d.id === notReady.id)).toBe(false);
  });

  it('resetForRetry volta para pending + limpa lastError', async () => {
    const d = await store.create({
      endpointId: 'ep-reset',
      event: 'order.paid',
      payload: {},
    });
    await store.markAttempt(d.id, {
      status: 'failed',
      lastError: 'timeout',
    });
    await store.resetForRetry(d.id);
    const after = await store.findById(d.id);
    expect(after!.status).toBe('pending');
    expect(after!.lastError).toBeUndefined();
  });

  it('findById retorna null pra inexistente', async () => {
    expect(await store.findById('whd-nao-existe')).toBeNull();
  });

  it('listAll respeita limit', async () => {
    const r = await store.listAll(2);
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
