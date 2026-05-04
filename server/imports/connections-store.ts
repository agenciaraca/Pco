// Conexões para importação via API (WordPress + LearnDash + WooCommerce).
// Credenciais sempre armazenadas criptografadas (AES-GCM 256).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';

export type ConnectionKind = 'wp_ld_wc';

export interface ImportConnection {
  id: string;
  name: string;
  kind: ConnectionKind;
  siteUrl: string;
  // Para WP/LD: usa Application Password de admin (ou Basic Auth)
  wpUsername?: string;
  wpAppPassword?: string; // ENCRYPTED
  // Para WooCommerce: consumer_key + consumer_secret
  wcConsumerKey?: string; // ENCRYPTED
  wcConsumerSecret?: string; // ENCRYPTED
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
}

export interface ImportConnectionPublicView extends Omit<
  ImportConnection,
  'wpAppPassword' | 'wcConsumerKey' | 'wcConsumerSecret'
> {
  hasWpAppPassword: boolean;
  hasWcConsumerKey: boolean;
  hasWcConsumerSecret: boolean;
}

const store = new JsonStore<ImportConnection>('import-connections.json', () => []);

function newId(): string {
  return `imc-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listConnections(): Promise<ImportConnectionPublicView[]> {
  const all = await store.getAll();
  return all.map(toPublic);
}

export async function getConnection(id: string): Promise<ImportConnection | null> {
  return await store.findOne((c) => c.id === id);
}

export async function getConnectionPublic(
  id: string,
): Promise<ImportConnectionPublicView | null> {
  const c = await getConnection(id);
  return c ? toPublic(c) : null;
}

export interface ImportConnectionInput {
  name: string;
  kind?: ConnectionKind;
  siteUrl: string;
  wpUsername?: string;
  wpAppPassword?: string; // plain
  wcConsumerKey?: string; // plain
  wcConsumerSecret?: string; // plain
}

export async function createConnection(
  input: ImportConnectionInput,
): Promise<ImportConnectionPublicView> {
  const now = new Date().toISOString();
  const conn: ImportConnection = {
    id: newId(),
    name: input.name,
    kind: input.kind ?? 'wp_ld_wc',
    siteUrl: normalizeUrl(input.siteUrl),
    wpUsername: input.wpUsername,
    wpAppPassword: input.wpAppPassword ? encryptApiKey(input.wpAppPassword) : undefined,
    wcConsumerKey: input.wcConsumerKey ? encryptApiKey(input.wcConsumerKey) : undefined,
    wcConsumerSecret: input.wcConsumerSecret
      ? encryptApiKey(input.wcConsumerSecret)
      : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(conn);
  return toPublic(conn);
}

export async function updateConnection(
  id: string,
  patch: Partial<ImportConnectionInput>,
): Promise<ImportConnectionPublicView | null> {
  const updated = await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      name: patch.name ?? c.name,
      siteUrl: patch.siteUrl ? normalizeUrl(patch.siteUrl) : c.siteUrl,
      wpUsername: patch.wpUsername ?? c.wpUsername,
      wpAppPassword:
        patch.wpAppPassword !== undefined && patch.wpAppPassword !== ''
          ? encryptApiKey(patch.wpAppPassword)
          : c.wpAppPassword,
      wcConsumerKey:
        patch.wcConsumerKey !== undefined && patch.wcConsumerKey !== ''
          ? encryptApiKey(patch.wcConsumerKey)
          : c.wcConsumerKey,
      wcConsumerSecret:
        patch.wcConsumerSecret !== undefined && patch.wcConsumerSecret !== ''
          ? encryptApiKey(patch.wcConsumerSecret)
          : c.wcConsumerSecret,
      updatedAt: new Date().toISOString(),
    }),
  );
  return updated ? toPublic(updated) : null;
}

export async function deleteConnection(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((c) => c.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

export async function recordTestResult(
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

export interface DecryptedCreds {
  wpUsername?: string;
  wpAppPassword?: string;
  wcConsumerKey?: string;
  wcConsumerSecret?: string;
}

export function decryptCreds(c: ImportConnection): DecryptedCreds {
  return {
    wpUsername: c.wpUsername,
    wpAppPassword: c.wpAppPassword ? decryptApiKey(c.wpAppPassword) : undefined,
    wcConsumerKey: c.wcConsumerKey ? decryptApiKey(c.wcConsumerKey) : undefined,
    wcConsumerSecret: c.wcConsumerSecret ? decryptApiKey(c.wcConsumerSecret) : undefined,
  };
}

function toPublic(c: ImportConnection): ImportConnectionPublicView {
  const { wpAppPassword, wcConsumerKey, wcConsumerSecret, ...rest } = c;
  return {
    ...rest,
    hasWpAppPassword: !!wpAppPassword,
    hasWcConsumerKey: !!wcConsumerKey,
    hasWcConsumerSecret: !!wcConsumerSecret,
  };
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}
