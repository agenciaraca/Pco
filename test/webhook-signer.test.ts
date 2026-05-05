import { describe, it, expect } from 'vitest';
import { signPayload } from '../server/webhooks/signer';
import crypto from 'node:crypto';

describe('webhook signer (HMAC-SHA256)', () => {
  it('produz formato t=<unix>,v1=<hex64>', () => {
    const sig = signPayload('mysecret', 'hello');
    expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it('é determinístico para o mesmo timestamp e body', () => {
    const a = signPayload('s', 'body', 1_700_000_000_000);
    const b = signPayload('s', 'body', 1_700_000_000_000);
    expect(a).toBe(b);
  });

  it('muda quando o body muda', () => {
    const a = signPayload('s', 'body1', 1_700_000_000_000);
    const b = signPayload('s', 'body2', 1_700_000_000_000);
    expect(a).not.toBe(b);
  });

  it('muda quando o secret muda', () => {
    const a = signPayload('s1', 'body', 1_700_000_000_000);
    const b = signPayload('s2', 'body', 1_700_000_000_000);
    expect(a).not.toBe(b);
  });

  it('hmac é verificável (round-trip manual)', () => {
    const secret = 'whsec_abc123';
    const body = '{"event":"order.paid"}';
    const ts = 1_700_000_000_000;
    const sig = signPayload(secret, body, ts);
    const v1 = sig.match(/v1=([a-f0-9]+)/)?.[1] ?? '';
    const t = sig.match(/t=(\d+)/)?.[1] ?? '';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${t}.${body}`)
      .digest('hex');
    expect(v1).toBe(expected);
  });
});
