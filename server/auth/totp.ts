// TOTP (RFC 6238) puro com Node crypto. Compatível com Google Authenticator,
// Authy, 1Password, Microsoft Authenticator etc.
//
// - Algoritmo HMAC-SHA1
// - Step de 30s
// - 6 dígitos
// - Janela de tolerância: ±1 step (para tolerar drift de relógio)

import crypto from 'node:crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(8);
    let s = '';
    for (let j = 0; j < 8; j++) {
      s += BASE32_ALPHABET[buf[j]! % BASE32_ALPHABET.length];
    }
    codes.push(s.slice(0, 4) + '-' + s.slice(4, 8));
  }
  return codes;
}

/** Hash backup code (SHA-256) — guardamos só hash, nunca o código em claro. */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.replace(/\s+/g, '').toLowerCase()).digest('hex');
}

/** otpauth:// URI para QR code. */
export function buildOtpauthUri(opts: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = opts.issuer ?? 'AVA PCO';
  const label = `${issuer}:${opts.accountName}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotp(secret: string, token: string, when = Date.now()): boolean {
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = Math.floor(when / 1000 / STEP_SECONDS);
  for (let w = -WINDOW; w <= WINDOW; w++) {
    if (computeCode(secret, counter + w) === cleaned) return true;
  }
  return false;
}

export function generateCurrentCode(secret: string, when = Date.now()): string {
  const counter = Math.floor(when / 1000 / STEP_SECONDS);
  return computeCode(secret, counter);
}

function computeCode(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // Counter as 8-byte big-endian
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]!;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
