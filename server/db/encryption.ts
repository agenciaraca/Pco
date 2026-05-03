// Criptografia AES-GCM 256-bit para chaves de API armazenadas em DB.
//
// Formato do payload: `<iv-base64>.<ciphertext-base64>.<authTag-base64>`
//
// A master key é derivada de AI_KEY_ENCRYPTION_SECRET (env var, 64 hex chars = 32 bytes).
// Em desenvolvimento sem a env, a função de criptografia faz pass-through prefixado
// com `dev:` para evitar criptografar com chave fraca — mas nunca persiste em DB
// porque os repositórios em modo dev/seed não escrevem em DB.

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const DEV_PREFIX = 'dev:';

function getKey(): Buffer | null {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;
  // Se vem em hex (preferido), usa diretamente. Senão, deriva via SHA-256.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptApiKey(plain: string): string {
  if (!plain) return '';
  const key = getKey();
  if (!key) {
    // Sem master key — usado só em dev/test. Marcamos com prefixo para detectar.
    return `${DEV_PREFIX}${Buffer.from(plain, 'utf8').toString('base64')}`;
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), enc.toString('base64'), tag.toString('base64')].join('.');
}

export function decryptApiKey(payload: string): string {
  if (!payload) return '';
  if (payload.startsWith(DEV_PREFIX)) {
    return Buffer.from(payload.slice(DEV_PREFIX.length), 'base64').toString('utf8');
  }
  const key = getKey();
  if (!key) {
    throw new Error('AI_KEY_ENCRYPTION_SECRET ausente — não é possível descriptografar.');
  }
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Payload encriptado inválido.');
  }
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('IV ou tag com tamanho inválido.');
  }
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function isEncrypted(payload: string): boolean {
  if (!payload) return false;
  if (payload.startsWith(DEV_PREFIX)) return true;
  return payload.split('.').length === 3;
}
