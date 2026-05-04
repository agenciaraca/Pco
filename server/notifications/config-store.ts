// Store de configurações de e-mail. Credenciais sempre criptografadas.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';
import type { EmailConfig, EmailProviderId } from './types';

const store = new JsonStore<EmailConfig>('email-configs.json', () => []);

function newId(): string {
  return `emc-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export interface EmailConfigPublicView extends Omit<
  EmailConfig,
  'apiKeyEncrypted' | 'smtpPasswordEncrypted'
> {
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
}

function toPublic(c: EmailConfig): EmailConfigPublicView {
  const { apiKeyEncrypted, smtpPasswordEncrypted, ...rest } = c;
  return {
    ...rest,
    hasApiKey: !!apiKeyEncrypted,
    hasSmtpPassword: !!smtpPasswordEncrypted,
  };
}

export async function listConfigs(): Promise<EmailConfigPublicView[]> {
  const all = await store.getAll();
  return all.map(toPublic);
}

export async function getConfig(id: string): Promise<EmailConfig | null> {
  return await store.findOne((c) => c.id === id);
}

/** Retorna o primeiro config ativo (enabled=true), preferindo não-mock. */
export async function getActiveConfig(): Promise<EmailConfig | null> {
  const all = await store.getAll();
  const active = all.filter((c) => c.enabled);
  if (active.length === 0) return null;
  // Prioriza providers reais sobre mock
  const real = active.find((c) => c.provider !== 'mock');
  return real ?? active[0]!;
}

export interface EmailConfigInput {
  provider: EmailProviderId;
  enabled?: boolean;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  apiKey?: string; // plain
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string; // plain
  smtpSecure?: boolean;
}

export async function createConfig(
  input: EmailConfigInput,
): Promise<EmailConfigPublicView> {
  const now = new Date().toISOString();
  const cfg: EmailConfig = {
    id: newId(),
    provider: input.provider,
    enabled: input.enabled ?? true,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    replyToEmail: input.replyToEmail,
    apiKeyEncrypted: input.apiKey ? encryptApiKey(input.apiKey) : undefined,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUser: input.smtpUser,
    smtpPasswordEncrypted: input.smtpPassword
      ? encryptApiKey(input.smtpPassword)
      : undefined,
    smtpSecure: input.smtpSecure,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(cfg);
  return toPublic(cfg);
}

export async function updateConfig(
  id: string,
  patch: Partial<EmailConfigInput>,
): Promise<EmailConfigPublicView | null> {
  const updated = await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      provider: patch.provider ?? c.provider,
      enabled: patch.enabled ?? c.enabled,
      fromEmail: patch.fromEmail ?? c.fromEmail,
      fromName: patch.fromName ?? c.fromName,
      replyToEmail: patch.replyToEmail ?? c.replyToEmail,
      apiKeyEncrypted:
        patch.apiKey !== undefined && patch.apiKey !== ''
          ? encryptApiKey(patch.apiKey)
          : c.apiKeyEncrypted,
      smtpHost: patch.smtpHost ?? c.smtpHost,
      smtpPort: patch.smtpPort ?? c.smtpPort,
      smtpUser: patch.smtpUser ?? c.smtpUser,
      smtpPasswordEncrypted:
        patch.smtpPassword !== undefined && patch.smtpPassword !== ''
          ? encryptApiKey(patch.smtpPassword)
          : c.smtpPasswordEncrypted,
      smtpSecure: patch.smtpSecure ?? c.smtpSecure,
      updatedAt: new Date().toISOString(),
    }),
  );
  return updated ? toPublic(updated) : null;
}

export async function deleteConfig(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((c) => c.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

export async function recordTest(
  id: string,
  status: 'ok' | 'error',
  message: string,
): Promise<void> {
  await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: status,
      lastTestMessage: message,
    }),
  );
}

export interface DecryptedEmailCreds {
  apiKey?: string;
  smtpPassword?: string;
}

export function decryptCreds(c: EmailConfig): DecryptedEmailCreds {
  return {
    apiKey: c.apiKeyEncrypted ? decryptApiKey(c.apiKeyEncrypted) : undefined,
    smtpPassword: c.smtpPasswordEncrypted
      ? decryptApiKey(c.smtpPasswordEncrypted)
      : undefined,
  };
}
