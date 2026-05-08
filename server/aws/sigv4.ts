// Implementação manual de AWS Signature V4 — sem AWS SDK.
// Baseada em https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
//
// Limitada ao que o provider SES precisa: POST JSON com host único.
// Não suporta query strings, multipart, nem assinatura de URL pré-assinada.

import { createHmac, createHash } from 'node:crypto';

export interface SigV4Input {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  host: string; // ex: email.us-east-1.amazonaws.com
  path: string; // ex: /v2/email/outbound-emails
  body: string; // JSON stringificado
  region: string;
  service: string; // ex: 'ses'
  accessKeyId: string;
  secretAccessKey: string;
  /** Headers adicionais que entrarao no canonical request. */
  extraHeaders?: Record<string, string>;
  /** Date override pra teste — Date object. */
  now?: Date;
}

function hex(buf: Buffer | string): string {
  if (typeof buf === 'string') return buf;
  return buf.toString('hex');
}

function sha256(payload: string | Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function hmac(key: string | Buffer, msg: string): Buffer {
  return createHmac('sha256', key).update(msg).digest();
}

function isoDate(d: Date): { amzDate: string; dateStamp: string } {
  // YYYYMMDDTHHMMSSZ + YYYYMMDD
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return { amzDate: `${y}${m}${day}T${hh}${mm}${ss}Z`, dateStamp: `${y}${m}${day}` };
}

export interface SigV4Output {
  headers: Record<string, string>;
  amzDate: string;
}

export function signSigV4(input: SigV4Input): SigV4Output {
  const now = input.now ?? new Date();
  const { amzDate, dateStamp } = isoDate(now);
  const payloadHash = sha256(input.body);

  const baseHeaders: Record<string, string> = {
    host: input.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(input.extraHeaders ?? {}),
  };
  // Canonical headers — chave em lowercase, valor trimmed, sorted by key.
  const sortedKeys = Object.keys(baseHeaders)
    .map((k) => k.toLowerCase())
    .sort();
  const lcHeaders: Record<string, string> = {};
  for (const k of Object.keys(baseHeaders)) {
    lcHeaders[k.toLowerCase()] = baseHeaders[k].trim().replace(/\s+/g, ' ');
  }
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${lcHeaders[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');

  const canonicalRequest = [
    input.method,
    input.path,
    '', // canonical query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmac('AWS4' + input.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hex(hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    amzDate,
    headers: {
      ...baseHeaders,
      Authorization: authorization,
    },
  };
}
