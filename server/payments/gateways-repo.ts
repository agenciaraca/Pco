// Repository para gateways de pagamento. Credenciais sempre encriptadas em disco.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';
import type {
  PaymentGateway,
  PaymentGatewayPublic,
  PaymentProvider,
  PaymentMode,
} from './types';

const store = new JsonStore<PaymentGateway>('payment-gateways.json', () => []);

function newId(): string {
  return `gw-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export function toPublic(g: PaymentGateway): PaymentGatewayPublic {
  // Não expõe segredos. Só metadados.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey, apiSecret, webhookSecret, ...rest } = g;
  return {
    ...rest,
    hasApiKey: !!apiKey,
    hasApiSecret: !!apiSecret,
    hasWebhookSecret: !!webhookSecret,
  };
}

export async function listAll(): Promise<PaymentGatewayPublic[]> {
  const all = await store.getAll();
  return all.map(toPublic);
}

export async function findById(id: string): Promise<PaymentGateway | null> {
  return await store.findOne((g) => g.id === id);
}

export async function findActiveByProvider(
  provider: PaymentProvider,
): Promise<PaymentGateway | null> {
  return await store.findOne((g) => g.provider === provider && g.active);
}

export async function listActive(): Promise<PaymentGateway[]> {
  return await store.filter((g) => g.active);
}

interface CreateInput {
  provider: PaymentProvider;
  displayName: string;
  mode: PaymentMode;
  active?: boolean;
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
  publicKey?: string;
  options?: Record<string, unknown>;
}

export async function createGateway(input: CreateInput): Promise<PaymentGatewayPublic> {
  const now = new Date().toISOString();
  const g: PaymentGateway = {
    id: newId(),
    provider: input.provider,
    displayName: input.displayName,
    mode: input.mode,
    active: input.active ?? false,
    apiKey: encryptApiKey(input.apiKey),
    apiSecret: input.apiSecret ? encryptApiKey(input.apiSecret) : null,
    webhookSecret: input.webhookSecret ? encryptApiKey(input.webhookSecret) : null,
    publicKey: input.publicKey ?? null,
    options: input.options ?? {},
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(g);
  return toPublic(g);
}

interface UpdateInput {
  displayName?: string;
  mode?: PaymentMode;
  active?: boolean;
  apiKey?: string; // se undefined, mantém; string vazia também mantém
  apiSecret?: string | null;
  webhookSecret?: string | null;
  publicKey?: string | null;
  options?: Record<string, unknown>;
}

export async function updateGateway(
  id: string,
  patch: UpdateInput,
): Promise<PaymentGatewayPublic | null> {
  const updated = await store.update(
    (g) => g.id === id,
    (g) => {
      const next: PaymentGateway = {
        ...g,
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.publicKey !== undefined ? { publicKey: patch.publicKey } : {}),
        ...(patch.options !== undefined ? { options: patch.options } : {}),
        updatedAt: new Date().toISOString(),
      };
      // Credenciais: só sobrescreve se input for não-vazio
      if (patch.apiKey && patch.apiKey.length > 0) {
        next.apiKey = encryptApiKey(patch.apiKey);
      }
      if (patch.apiSecret !== undefined) {
        next.apiSecret = patch.apiSecret ? encryptApiKey(patch.apiSecret) : null;
      }
      if (patch.webhookSecret !== undefined) {
        next.webhookSecret = patch.webhookSecret
          ? encryptApiKey(patch.webhookSecret)
          : null;
      }
      return next;
    },
  );
  return updated ? toPublic(updated) : null;
}

export async function deleteGateway(id: string): Promise<boolean> {
  return await store.remove((g) => g.id === id);
}

/** Retorna credenciais decryptadas — só usar dentro do server. */
export async function getDecryptedCredentials(
  id: string,
): Promise<{ apiKey: string; apiSecret: string; webhookSecret: string } | null> {
  const g = await findById(id);
  if (!g) return null;
  return {
    apiKey: g.apiKey ? decryptApiKey(g.apiKey) : '',
    apiSecret: g.apiSecret ? decryptApiKey(g.apiSecret) : '',
    webhookSecret: g.webhookSecret ? decryptApiKey(g.webhookSecret) : '',
  };
}
