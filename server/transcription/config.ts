import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';
import type { TranscriptionProviderId } from './types';

export interface TranscriptionConfig {
  provider: TranscriptionProviderId;
  apiKeyEncrypted: string;
  model?: string;
  language: string;
  enabled: boolean;
  updatedAt: string;
}

const store = new JsonStore<TranscriptionConfig>(
  'transcription-config.json',
  () => [],
);

export async function getConfig(): Promise<TranscriptionConfig | null> {
  const all = await store.getAll();
  return all[0] ?? null;
}

export async function setConfig(input: {
  provider: TranscriptionProviderId;
  apiKey: string;
  model?: string;
  language?: string;
}): Promise<TranscriptionConfig> {
  const now = new Date().toISOString();
  const cfg: TranscriptionConfig = {
    provider: input.provider,
    apiKeyEncrypted: encryptApiKey(input.apiKey),
    model: input.model,
    language: input.language ?? 'pt',
    enabled: true,
    updatedAt: now,
  };
  await store.setAll([cfg]);
  return cfg;
}

export function getDecryptedKey(cfg: TranscriptionConfig): string {
  return decryptApiKey(cfg.apiKeyEncrypted);
}

export function getPublicConfig(cfg: TranscriptionConfig) {
  return {
    provider: cfg.provider,
    model: cfg.model,
    language: cfg.language,
    enabled: cfg.enabled,
    hasKey: !!cfg.apiKeyEncrypted,
  };
}
