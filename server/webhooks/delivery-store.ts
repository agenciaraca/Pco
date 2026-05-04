// Store de entregas (deliveries). Capada em 5000 entradas no total.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { WebhookDelivery, WebhookDeliveryStatus, WebhookEventType } from './types';

const MAX = 5000;
const store = new JsonStore<WebhookDelivery>('webhook-deliveries.json', () => []);

function newId(): string {
  return `whd-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(limit = 200): Promise<WebhookDelivery[]> {
  const all = await store.getAll();
  return [...all]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, MAX)));
}

export async function listByEndpoint(
  endpointId: string,
  limit = 100,
): Promise<WebhookDelivery[]> {
  const all = await store.filter((d) => d.endpointId === endpointId);
  return [...all]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function pending(): Promise<WebhookDelivery[]> {
  const now = new Date().toISOString();
  return await store.filter(
    (d) =>
      (d.status === 'pending' || d.status === 'retrying') &&
      (!d.nextAttemptAt || d.nextAttemptAt <= now),
  );
}

export async function findById(id: string): Promise<WebhookDelivery | null> {
  return await store.findOne((d) => d.id === id);
}

export async function create(input: {
  endpointId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
}): Promise<WebhookDelivery> {
  const now = new Date().toISOString();
  const d: WebhookDelivery = {
    id: newId(),
    endpointId: input.endpointId,
    event: input.event,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
  };
  // Cap aplicado no final — mantém os mais recentes
  const all = await store.getAll();
  const next = [d, ...all].slice(0, MAX);
  await store.setAll(next);
  return d;
}

export async function markAttempt(
  id: string,
  patch: {
    status: WebhookDeliveryStatus;
    nextAttemptAt?: string;
    lastResponseStatus?: number;
    lastResponseBody?: string;
    lastError?: string;
    completedAt?: string;
  },
): Promise<void> {
  await store.update(
    (d) => d.id === id,
    (d) => ({
      ...d,
      ...patch,
      attempts: d.attempts + 1,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function resetForRetry(id: string): Promise<void> {
  await store.update(
    (d) => d.id === id,
    (d) => ({
      ...d,
      status: 'pending',
      nextAttemptAt: new Date().toISOString(),
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }),
  );
}
