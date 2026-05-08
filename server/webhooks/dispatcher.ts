// Dispatcher de webhooks — emit() enfileira, runWorker() faz POST com retries.

import * as endpoints from './endpoints-store';
import * as deliveries from './delivery-store';
import { signPayload } from './signer';
import { RETRY_DELAYS_MS, MAX_ATTEMPTS } from './types';
import type {
  WebhookEventType,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookChannelType,
} from './types';
import {
  formatGeneric,
  formatSlack,
  formatDiscord,
  formatTelegram,
  formatTeams,
  formatMattermost,
} from './formatters';

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
let lastRunAt: string | null = null;
let lastRunProcessed = 0;
let totalTicks = 0;
let intervalMsCfg = 30_000;

export function startWorker(intervalMs = 30_000): void {
  if (workerInterval) return;
  intervalMsCfg = intervalMs;
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

export function getStatus() {
  return {
    name: 'webhooks',
    running: workerRunning,
    intervalMs: intervalMsCfg,
    lastRunAt,
    lastRunProcessed,
    totalTicks,
    enabled: workerInterval !== null,
  };
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
    lastRunAt = new Date().toISOString();
    lastRunProcessed = processed;
    totalTicks++;
  }
  return { processed };
}

/**
 * Channels que postam em servico externo de chat (Slack/Discord/Teams/
 * Telegram/Mattermost) nao deveriam ter HMAC porque o cliente nao
 * controla o servidor. Apenas channels 'generic' assinam.
 */
function isHmacChannel(t: WebhookChannelType | undefined): boolean {
  return !t || t === 'generic';
}

function renderBody(
  e: WebhookEndpoint,
  d: WebhookDelivery,
  ts: string,
  extraHeaders?: Record<string, string>,
): unknown {
  const input = {
    event: d.event,
    data: d.payload,
    deliveryId: d.id,
    ts,
  };
  if (e.channelType === 'slack') return formatSlack(input);
  if (e.channelType === 'discord') return formatDiscord(input);
  if (e.channelType === 'telegram') {
    // chat_id vem dos headers extras (X-Telegram-Chat-Id) já que a URL
    // do bot não comporta query strings sem quebrar o encoding.
    const chatId =
      extraHeaders?.['X-Telegram-Chat-Id'] ?? extraHeaders?.['x-telegram-chat-id'];
    return formatTelegram(input, chatId);
  }
  if (e.channelType === 'teams') return formatTeams(input);
  if (e.channelType === 'mattermost') return formatMattermost(input);
  return formatGeneric(input);
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
  const ts = new Date().toISOString();
  const body = renderBody(e, d, ts, extraHeaders);
  const raw = JSON.stringify(body);
  // Channels que rendem payload p/ um serviço de chat externo não
  // verificam HMAC (não controlam o servidor). Só assinamos generic.
  const sig = isHmacChannel(e.channelType) && secret ? signPayload(secret, raw) : undefined;
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
  const ts = new Date().toISOString();
  const testDelivery = {
    id: `test-${Date.now()}`,
    event: 'test.ping' as WebhookEventType,
    payload: { hello: 'world', source: 'AVA PCO' },
  } as unknown as WebhookDelivery;
  const body = renderBody(e, testDelivery, ts, extraHeaders);
  const raw = JSON.stringify(body);
  const sig = isHmacChannel(e.channelType) && secret ? signPayload(secret, raw) : undefined;
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
