import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let dispatcher: typeof import('../server/webhooks/dispatcher');
let endpoints: typeof import('../server/webhooks/endpoints-store');
let deliveries: typeof import('../server/webhooks/delivery-store');
let originalFetch: typeof globalThis.fetch;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-disp-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
  dispatcher = await import('../server/webhooks/dispatcher');
  endpoints = await import('../server/webhooks/endpoints-store');
  deliveries = await import('../server/webhooks/delivery-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  // Limpa stores entre testes
  await endpoints._resetForTests?.();
  await deliveries._resetForTests?.();
});

describe('webhooks/dispatcher', () => {
  describe('testEndpoint', () => {
    it('faz POST com payload de teste e retorna ok=true em 200', async () => {
      let calledUrl = '';
      let calledBody = '';
      globalThis.fetch = vi.fn(async (url, init) => {
        calledUrl = String(url);
        calledBody = String((init as RequestInit).body);
        return {
          ok: true,
          status: 200,
          text: async () => 'OK',
        } as unknown as Response;
      });
      const ep = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://hook.test/in',
        events: ['order.paid'],
        channelType: 'generic',
      });
      const res = await dispatcher.testEndpoint(ep.id);
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(calledUrl).toBe('https://hook.test/in');
      expect(calledBody).toContain('"event":"test'); // testEndpoint envia event=test.something
    });

    it('retorna ok=false em HTTP 500', async () => {
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 500,
          text: async () => 'Server Error',
        } as unknown as Response;
      });
      const ep = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://hook.test/fail',
        events: ['order.paid'],
        channelType: 'generic',
      });
      const res = await dispatcher.testEndpoint(ep.id);
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
    });

    it('retorna error quando endpoint não existe', async () => {
      const res = await dispatcher.testEndpoint('ep-inexistente');
      expect(res.ok).toBe(false);
      expect(res.error).toBeTruthy();
    });

    it('captura erro de rede (network failure)', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('ENETUNREACH');
      });
      const ep = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://offline.test/in',
        events: ['order.paid'],
        channelType: 'generic',
      });
      const res = await dispatcher.testEndpoint(ep.id);
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/ENETUNREACH/);
    });
  });

  describe('tickWorker — process pending deliveries', () => {
    // Helper: aguarda o tick interno disparado por emit() concluir
    async function waitForTick() {
      await new Promise((r) => setTimeout(r, 50));
    }

    it('marca success em 200', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '',
      } as unknown as Response));
      const ep = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://hook.test/ok',
        events: ['order.paid'],
        channelType: 'generic',
      });
      await dispatcher.emit('order.paid', { id: 'order-1', amount: 100 });
      await waitForTick();
      const all = await deliveries.listAll();
      const succ = all.filter((d) => d.status === 'success');
      expect(succ.length).toBeGreaterThanOrEqual(1);
      expect(succ[0].endpointId).toBe(ep.id);
    });

    it('schedules retry em HTTP 500', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'fail',
      } as unknown as Response));
      await endpoints.createEndpoint({
        name: 'test',
        url: 'https://hook.test/500',
        events: ['order.paid'],
        channelType: 'generic',
      });
      await dispatcher.emit('order.paid', {});
      await waitForTick();
      const all = await deliveries.listAll();
      const retry = all.find((d) => d.status === 'retrying');
      expect(retry).toBeDefined();
      expect(retry!.nextAttemptAt).toBeTruthy();
      expect(retry!.attempts).toBe(1);
    });

    it('skip quando endpoint foi desativado', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '',
      } as unknown as Response));
      const ep = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://hook.test/x',
        events: ['order.paid'],
        channelType: 'generic',
      });
      // Desativa ANTES de emit, pra evitar race com tick interno
      await endpoints.updateEndpoint(ep.id, { enabled: false });
      // Cria delivery manualmente apontando pro endpoint disabled
      await deliveries.create({
        endpointId: ep.id,
        event: 'order.paid',
        payload: {},
      });
      await dispatcher.tickWorker();
      const all = await deliveries.listAll();
      const failed = all.find((d) => d.status === 'failed');
      expect(failed?.lastError).toMatch(/desativado|removido/i);
    });
  });

  describe('emit', () => {
    it('cria deliveries pendentes para cada endpoint subscribed', async () => {
      const e1 = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://h1.test',
        events: ['user.created'],
        channelType: 'generic',
      });
      const e2 = await endpoints.createEndpoint({
        name: 'test',
        url: 'https://h2.test',
        events: ['user.created', 'order.paid'],
        channelType: 'generic',
      });
      await endpoints.createEndpoint({
        name: 'test',
        url: 'https://h3.test',
        events: ['order.paid'],
        channelType: 'generic',
      });
      await dispatcher.emit('user.created', { userId: 'u1' });
      const list = await deliveries.listAll();
      const matched = list.filter(
        (d) => d.endpointId === e1.id || d.endpointId === e2.id,
      );
      expect(matched).toHaveLength(2);
    });
  });
});
