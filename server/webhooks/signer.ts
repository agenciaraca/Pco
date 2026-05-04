// HMAC-SHA256 signing — formato compatível com Stripe-style "signature with timestamp".
//
// Header X-AVA-PCO-Signature: t=<unix-ts>,v1=<hex-hmac>
// Onde <hmac> = HMAC_SHA256(secret, `${t}.${rawBody}`)

import crypto from 'node:crypto';

export function signPayload(secret: string, rawBody: string, timestamp = Date.now()): string {
  const t = Math.floor(timestamp / 1000);
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex');
  return `t=${t},v1=${sig}`;
}
