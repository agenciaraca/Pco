// Tests do SigV4 manual — vetores derivados da especificação AWS.

import { describe, it, expect } from 'vitest';
import { signSigV4 } from '../server/notifications/providers/ses-sigv4';

describe('SigV4', () => {
  it('produz Authorization header com formato correto', () => {
    const out = signSigV4({
      method: 'POST',
      host: 'email.us-east-1.amazonaws.com',
      path: '/v2/email/outbound-emails',
      body: '{"hello":"world"}',
      region: 'us-east-1',
      service: 'ses',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(out.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(out.headers.Authorization).toContain('Credential=AKIAIOSFODNN7EXAMPLE/20260101/us-east-1/ses/aws4_request');
    expect(out.headers.Authorization).toMatch(/SignedHeaders=[a-z0-9;-]+/);
    expect(out.headers.Authorization).toMatch(/Signature=[0-9a-f]{64}$/);
  });

  it('amzDate em formato ISO basic', () => {
    const out = signSigV4({
      method: 'GET',
      host: 'h',
      path: '/',
      body: '',
      region: 'r',
      service: 's',
      accessKeyId: 'k',
      secretAccessKey: 's',
      now: new Date('2026-05-08T11:30:45Z'),
    });
    expect(out.amzDate).toBe('20260508T113045Z');
    expect(out.headers['x-amz-date']).toBe('20260508T113045Z');
  });

  it('inclui x-amz-content-sha256 do payload', () => {
    const out = signSigV4({
      method: 'POST',
      host: 'h',
      path: '/',
      body: 'hello',
      region: 'r',
      service: 's',
      accessKeyId: 'k',
      secretAccessKey: 's',
      now: new Date(0),
    });
    // sha256("hello") = 2cf24d...
    expect(out.headers['x-amz-content-sha256']).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('mesma entrada produz mesma assinatura (determinismo)', () => {
    const params = {
      method: 'POST' as const,
      host: 'h.com',
      path: '/p',
      body: 'b',
      region: 'us-west-2',
      service: 'ses',
      accessKeyId: 'AKIA',
      secretAccessKey: 'sec',
      now: new Date('2026-05-08T10:00:00Z'),
    };
    const a = signSigV4(params);
    const b = signSigV4(params);
    expect(a.headers.Authorization).toBe(b.headers.Authorization);
  });

  it('payload diferente muda assinatura', () => {
    const base = {
      method: 'POST' as const,
      host: 'h',
      path: '/',
      region: 'r',
      service: 's',
      accessKeyId: 'k',
      secretAccessKey: 's',
      now: new Date('2026-05-08T10:00:00Z'),
    };
    const a = signSigV4({ ...base, body: 'a' });
    const b = signSigV4({ ...base, body: 'b' });
    expect(a.headers.Authorization).not.toBe(b.headers.Authorization);
  });

  it('extraHeaders entram em SignedHeaders ordenados', () => {
    const out = signSigV4({
      method: 'POST',
      host: 'h',
      path: '/',
      body: '',
      region: 'r',
      service: 's',
      accessKeyId: 'k',
      secretAccessKey: 's',
      extraHeaders: { 'X-Custom': 'v', 'content-type': 'application/json' },
      now: new Date(0),
    });
    const m = out.headers.Authorization.match(/SignedHeaders=([^,]+)/);
    expect(m).not.toBeNull();
    const signed = m![1];
    expect(signed).toContain('content-type');
    expect(signed).toContain('host');
    expect(signed).toContain('x-amz-content-sha256');
    expect(signed).toContain('x-amz-date');
    expect(signed).toContain('x-custom');
    // alfabéticos
    const arr = signed.split(';');
    expect(arr).toEqual([...arr].sort());
  });
});
