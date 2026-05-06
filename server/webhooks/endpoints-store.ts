// Store de endpoints. Secret HMAC sempre criptografado.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';
import type {
  WebhookEndpoint,
  WebhookEventType,
  WebhookChannelType,
} from './types';

const store = new JsonStore<WebhookEndpoint>('webhook-endpoints.json', () => []);

function newId(): string {
  return `wh-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export interface PublicEndpoint extends Omit<WebhookEndpoint, 'secretEncrypted' | 'headersEncrypted'> {
  hasSecret: boolean;
  hasHeaders: boolean;
}

function toPublic(e: WebhookEndpoint): PublicEndpoint {
  const { secretEncrypted, headersEncrypted, ...rest } = e;
  return {
    ...rest,
    hasSecret: !!secretEncrypted,
    hasHeaders: !!headersEncrypted,
  };
}

export async function listEndpoints(): Promise<PublicEndpoint[]> {
  const all = await store.getAll();
  return all.map(toPublic);
}

export async function getEndpoint(id: string): Promise<WebhookEndpoint | null> {
  return await store.findOne((e) => e.id === id);
}

/** Lista todos endpoints HABILITADOS que assinam o evento. */
export async function listForEvent(event: WebhookEventType): Promise<WebhookEndpoint[]> {
  return await store.filter((e) => e.enabled && e.events.includes(event));
}

export interface EndpointInput {
  name: string;
  url: string;
  events: WebhookEventType[];
  enabled?: boolean;
  channelType?: WebhookChannelType;
  secret?: string;
  headers?: Record<string, string>;
}

export async function createEndpoint(input: EndpointInput): Promise<PublicEndpoint> {
  const now = new Date().toISOString();
  const e: WebhookEndpoint = {
    id: newId(),
    name: input.name,
    url: input.url,
    events: input.events,
    enabled: input.enabled !== false,
    channelType: input.channelType ?? 'generic',
    secretEncrypted: input.secret ? encryptApiKey(input.secret) : undefined,
    headersEncrypted: input.headers
      ? encryptApiKey(JSON.stringify(input.headers))
      : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(e);
  return toPublic(e);
}

export async function updateEndpoint(
  id: string,
  patch: Partial<EndpointInput>,
): Promise<PublicEndpoint | null> {
  const updated = await store.update(
    (e) => e.id === id,
    (e) => ({
      ...e,
      name: patch.name ?? e.name,
      url: patch.url ?? e.url,
      events: patch.events ?? e.events,
      enabled: patch.enabled ?? e.enabled,
      channelType: patch.channelType ?? e.channelType,
      secretEncrypted:
        patch.secret !== undefined && patch.secret !== ''
          ? encryptApiKey(patch.secret)
          : e.secretEncrypted,
      headersEncrypted:
        patch.headers !== undefined
          ? encryptApiKey(JSON.stringify(patch.headers))
          : e.headersEncrypted,
      updatedAt: new Date().toISOString(),
    }),
  );
  return updated ? toPublic(updated) : null;
}

export async function deleteEndpoint(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((e) => e.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

export async function recordSuccess(id: string): Promise<void> {
  await store.update(
    (e) => e.id === id,
    (e) => ({
      ...e,
      lastSuccessAt: new Date().toISOString(),
      lastErrorMessage: undefined,
    }),
  );
}

export async function recordFailure(id: string, msg: string): Promise<void> {
  await store.update(
    (e) => e.id === id,
    (e) => ({
      ...e,
      lastFailureAt: new Date().toISOString(),
      lastErrorMessage: msg.slice(0, 500),
    }),
  );
}

export interface DecryptedEndpoint {
  secret?: string;
  headers?: Record<string, string>;
}

export function decryptEndpoint(e: WebhookEndpoint): DecryptedEndpoint {
  return {
    secret: e.secretEncrypted ? decryptApiKey(e.secretEncrypted) : undefined,
    headers: e.headersEncrypted
      ? (JSON.parse(decryptApiKey(e.headersEncrypted)) as Record<string, string>)
      : undefined,
  };
}

// Test-only helper
export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}
