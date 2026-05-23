import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';

export interface ZoomConfig {
  sdkKey: string;
  sdkSecretEncrypted: string;
  enabled: boolean;
  updatedAt: string;
}

const store = new JsonStore<ZoomConfig>('zoom-config.json', () => []);

export async function getConfig(): Promise<ZoomConfig | null> {
  const all = await store.getAll();
  return all[0] ?? null;
}

export async function setConfig(input: {
  sdkKey: string;
  sdkSecret: string;
}): Promise<ZoomConfig> {
  const now = new Date().toISOString();
  const cfg: ZoomConfig = {
    sdkKey: input.sdkKey,
    sdkSecretEncrypted: encryptApiKey(input.sdkSecret),
    enabled: true,
    updatedAt: now,
  };
  await store.setAll([cfg]);
  return cfg;
}

export async function disable(): Promise<void> {
  const cfg = await getConfig();
  if (cfg) {
    cfg.enabled = false;
    cfg.updatedAt = new Date().toISOString();
    await store.setAll([cfg]);
  }
}

export function getPublicConfig(cfg: ZoomConfig): {
  sdkKey: string;
  enabled: boolean;
  hasSecret: boolean;
} {
  return {
    sdkKey: cfg.sdkKey,
    enabled: cfg.enabled,
    hasSecret: !!cfg.sdkSecretEncrypted,
  };
}

export function generateSignature(
  sdkKey: string,
  sdkSecretEncrypted: string,
  meetingNumber: string,
  role: 0 | 1,
): string {
  const sdkSecret = decryptApiKey(sdkSecretEncrypted);
  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2h

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sdkKey,
      mn: meetingNumber,
      role,
      iat,
      exp,
      tokenExp: exp,
    }),
  ).toString('base64url');

  const message = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', sdkSecret)
    .update(message)
    .digest('base64url');

  return `${message}.${signature}`;
}
