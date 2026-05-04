// Dispatcher de webhooks — emit() enfileira, runWorker() faz POST com retries.

import * as endpoints from './endpoints-store';
import * as deliveries from './delivery-store';
import { signPayload } from './signer';
import { RETRY_DELAYS_MS, MAX_ATTEMPTS } from './types';
import type { WebhookEventType, WebhookDelivery } from './types';

const TIMEOUT_MS = 15_000;

/**
 * Emite um evento — cria deliveries para cada endpoint inscrito.
 * Não bloqueia: a entrega real acontece via worker.
 */
export async function emit(
  event: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const subscribed = await endpoints.listForEvent(event);
  for (const e of subscribed) {
    await deliveries.create({ endpointId: e.id, event, payload });
  }
  // Dispara worker (não bloqueia)
  void tickWorker().catch(() => {
    // Engolido — próximo tick vai pegar
  });
}

let workerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

export function startWorker(intervalMs = 30_000): void {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    void tickWorker();
  }, intervalMs);
  // Tick inicial
  void tickWorker();
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

/** Processa todas as entregas pendentes vencidas. */
export async function tickWorker(): Promise<{ processed: number }> {
  if (workerRunning) return { processed: 0 };
  workerRunning = true;
  let processed = 0;
  try {
    const pending = await deliveries.pending();
    for (const d of pending) {
      await deliverOne(d);
      processed++;
    }
  } finally {
    workerRunning = false;
  }
  return { processed };
}

async function deliverOne(d: WebhookDelivery): Promise<void> {
  const e = await endpoints.getEndpoint(d.endpointId);
  if (!e || !e.enabled) {
    await deliveries.markAttempt(d.id, {
      status: 'failed',
      lastError: 'Endpoint removido ou desativado.',
      completedAt: new Date().toISOString(),
    });
    return;
  }
  const { secret, headers: extraHeaders } = endpoints.decryptEndpoint(e);
  const body = {
    id: d.id,
    event: d.event,
    created: new Date().toISOString(),
    data: d.payload,
  };
  const raw = JSON.stringify(body);
  const sig = secret ? signPayload(secret, raw) : undefined;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(e.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AVA-PCO-Webhook/1.0',
        'X-AVA-PCO-Event': d.event,
        'X-AVA-PCO-Delivery': d.id,
        ...(sig ? { 'X-AVA-PCO-Signature': sig } : {}),
        ...(extraHeaders ?? {}),
      },
      body: raw,
    });
    const text = await res.text().catch(() => '');
    if (res.ok) {
      await deliveries.markAttempt(d.id, {
        status: 'success',
        lastResponseStatus: res.status,
        lastResponseBody: text.slice(0, 500),
        completedAt: new Date().toISOString(),
      });
      await endpoints.recordSuccess(e.id);
    } else {
      await scheduleRetryOrFail(d, e.id, res.status, text.slice(0, 500), `HTTP ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await scheduleRetryOrFail(d, e.id, undefined, undefined, msg);
  } finally {
    clearTimeout(t);
  }
}

async function scheduleRetryOrFail(
  d: WebhookDelivery,
  endpointId: string,
  status: number | undefined,
  body: string | undefined,
  errorMsg: string,
): Promise<void> {
  const nextAttempt = d.attempts + 1;
  if (nextAttempt >= MAX_ATTEMPTS) {
    await deliveries.markAttempt(d.id, {
      status: 'failed',
      lastResponseStatus: status,
      lastResponseBody: body,
      lastError: errorMsg,
      completedAt: new Date().toISOString(),
    });
    await endpoints.recordFailure(endpointId, errorMsg);
    return;
  }
  const delay = RETRY_DELAYS_MS[d.attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  const next = new Date(Date.now() + delay).toISOString();
  await deliveries.markAttempt(d.id, {
    status: 'retrying',
    lastResponseStatus: status,
    lastResponseBody: body,
    lastError: errorMsg,
    nextAttemptAt: next,
  });
  await endpoints.recordFailure(endpointId, errorMsg);
}

/** Envia um payload de teste para um endpoint específico (ignora subscribed events). */
export async function testEndpoint(endpointId: string): Promise<{
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}> {
  const e = await endpoints.getEndpoint(endpointId);
  if (!e) return { ok: false, error: 'Endpoint não encontrado.' };
  const { secret, headers: extraHeaders } = endpoints.decryptEndpoint(e);
  const body = {
    id: `test-${Date.now()}`,
    event: 'test.ping',
    created: new Date().toISOString(),
    data: { hello: 'world', source: 'AVA PCO' },
  };
  const raw = JSON.stringify(body);
  const sig = secret ? signPayload(secret, raw) : undefined;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(e.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AVA-PCO-Webhook/1.0',
        'X-AVA-PCO-Event': 'test.ping',
        ...(sig ? { 'X-AVA-PCO-Signature': sig } : {}),
        ...(extraHeaders ?? {}),
      },
      body: raw,
    });
    clearTimeout(t);
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
