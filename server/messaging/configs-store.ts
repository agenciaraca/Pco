// Store de configurações de mensageria (SMS / WhatsApp). Credenciais
// sempre criptografadas via encryptApiKey (AES-GCM 256).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey } from '../db/encryption';
import type { MessagingConfig, MessagingProviderId } from './types';

const store = new JsonStore<MessagingConfig>('messaging-configs.json', () => []);

function newId(): string {
  return `msgc-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export interface MessagingConfigPublicView extends Omit<
  MessagingConfig,
  'apiKeyEncrypted' | 'accountSidEncrypted'
> {
  hasApiKey: boolean;
  hasAccountSid: boolean;
}

function toPublic(c: MessagingConfig): MessagingConfigPublicView {
  const { apiKeyEncrypted, accountSidEncrypted, ...rest } = c;
  return {
    ...rest,
    hasApiKey: !!apiKeyEncrypted,
    hasAccountSid: !!accountSidEncrypted,
  };
}

export async function listConfigs(): Promise<MessagingConfigPublicView[]> {
  const all = await store.getAll();
  return all.map(toPublic);
}

export async function getConfig(id: string): Promise<MessagingConfig | null> {
  return await store.findOne((c) => c.id === id);
}

/** Retorna o primeiro config ativo para o provider, ou qualquer ativo. */
export async function getActiveConfig(
  preferProvider?: MessagingProviderId,
): Promise<MessagingConfig | null> {
  const all = await store.getAll();
  const active = all.filter((c) => c.enabled);
  if (active.length === 0) return null;
  if (preferProvider) {
    const pref = active.find((c) => c.provider === preferProvider);
    if (pref) return pref;
  }
  const real = active.find((c) => c.provider !== 'mock');
  return real ?? active[0]!;
}

export interface MessagingConfigInput {
  provider: MessagingProviderId;
  enabled?: boolean;
  fromNumber: string;
  apiKey?: string; // plain
  accountSid?: string; // plain (Twilio)
  whatsappPhoneNumberId?: string; // Meta WhatsApp Cloud
}

export async function createConfig(
  input: MessagingConfigInput,
): Promise<MessagingConfigPublicView> {
  const now = new Date().toISOString();
  const cfg: MessagingConfig = {
    id: newId(),
    provider: input.provider,
    enabled: input.enabled ?? true,
    fromNumber: input.fromNumber,
    apiKeyEncrypted: input.apiKey ? encryptApiKey(input.apiKey) : undefined,
    accountSidEncrypted: input.accountSid
      ? encryptApiKey(input.accountSid)
      : undefined,
    whatsappPhoneNumberId: input.whatsappPhoneNumberId,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(cfg);
  return toPublic(cfg);
}

export async function updateConfig(
  id: string,
  patch: Partial<MessagingConfigInput>,
): Promise<MessagingConfigPublicView | null> {
  const updated = await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.fromNumber !== undefined ? { fromNumber: patch.fromNumber } : {}),
      ...(patch.apiKey
        ? { apiKeyEncrypted: encryptApiKey(patch.apiKey) }
        : {}),
      ...(patch.accountSid
        ? { accountSidEncrypted: encryptApiKey(patch.accountSid) }
        : {}),
      ...(patch.whatsappPhoneNumberId !== undefined
        ? { whatsappPhoneNumberId: patch.whatsappPhoneNumberId || undefined }
        : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
  return updated ? toPublic(updated) : null;
}

export async function deleteConfig(id: string): Promise<boolean> {
  return await store.modify((rows) => {
    const idx = rows.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  });
}

/** Atualiza lastTested* após ping. */
export async function recordTest(
  id: string,
  result: { ok: boolean; message?: string },
): Promise<void> {
  await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: result.ok ? 'ok' : 'error',
      lastTestMessage: result.message,
      updatedAt: new Date().toISOString(),
    }),
  );
}
